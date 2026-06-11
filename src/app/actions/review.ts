"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  buildReviewPromptSnapshot,
  nextDueDate,
  resultFromScore,
  transitionMastery,
  type ReviewPromptSnapshot,
  type ReviewResult,
} from "@/domain/review";
import { PROMPT_VERSIONS } from "@/domain/constants";
import { generateJson } from "@/lib/ai/provider";
import { gradingPrompt } from "@/lib/ai/prompts";
import { gradingSchema } from "@/lib/ai/schemas";
import { requireUser } from "@/lib/auth/guards";

function normalizeAnswer(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function idempotencyKeyForReview(input: { conceptId: string; answer: string }) {
  const answerHash = createHash("sha256").update(input.answer).digest("hex").slice(0, 32);
  return `review-attempt:${input.conceptId}:${answerHash}`;
}

async function gradeReviewAnswer(input: {
  userId: string;
  conceptId: string;
  prompt: ReviewPromptSnapshot;
  answer: string;
}) {
  if (input.prompt.type === "meaning_choice" || input.prompt.type === "cloze_phrase") {
    const expected = [input.prompt.correctAnswer, ...(input.prompt.acceptableAnswers ?? [])]
      .filter(Boolean)
      .map((value) => normalizeAnswer(String(value)));
    const correct = expected.includes(normalizeAnswer(input.answer));
    return {
      gradingStatus: "succeeded" as const,
      score: correct ? 100 : 0,
      result: correct ? "correct" as const : "incorrect" as const,
      feedbackVi: correct
        ? "Đúng. Bạn đã nhớ lại được điểm ngữ cảnh này."
        : "Chưa đúng. Hãy tập trung vào nghĩa tự nhiên trong ngữ cảnh, không chỉ dịch từng từ.",
    };
  }

  try {
    const grade = await generateJson({
      userId: input.userId,
      purpose: "grading",
      prompt: gradingPrompt({
        promptEn: input.prompt.promptEn ?? "",
        promptVi: input.prompt.promptVi,
        answer: input.answer,
        rubricVi: input.prompt.rubricVi,
      }),
      promptVersion: PROMPT_VERSIONS.grading,
      schemaVersion: "grading",
      schema: gradingSchema,
      modelKind: "analysis",
    });
    return {
      gradingStatus: "succeeded" as const,
      score: grade.score,
      result: resultFromScore(grade.score),
      feedbackVi: grade.feedbackVi,
    };
  } catch (error) {
    console.error(error);
    return {
      gradingStatus: "failed" as const,
      score: null,
      result: "grading_failed" as const,
      feedbackVi: "Hệ thống chưa chấm được câu trả lời này. Bạn có thể thử chấm lại mà không cần viết lại.",
    };
  }
}

export async function submitReviewAttemptAction(formData: FormData) {
  const user = await requireUser();
  const conceptId = String(formData.get("conceptId") ?? "");
  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) return;

  const [concept] = await db
    .select()
    .from(schema.mistakeConcepts)
    .where(and(eq(schema.mistakeConcepts.id, conceptId), eq(schema.mistakeConcepts.userId, user.id)))
    .limit(1);
  if (!concept) return;

  const [pattern] = await db
    .select()
    .from(schema.mistakePatterns)
    .where(and(eq(schema.mistakePatterns.mistakeConceptId, concept.id), eq(schema.mistakePatterns.userId, user.id)))
    .limit(1);

  const promptSnapshot = buildReviewPromptSnapshot({
    conceptTitleVi: concept.titleVi,
    safeReviewSeed: concept.safeReviewSeed,
    fallbackMeaningVi: concept.explanationVi,
  });
  const idempotencyKey = idempotencyKeyForReview({ conceptId: concept.id, answer });
  const [existing] = await db
    .select()
    .from(schema.reviewAttempts)
    .where(and(eq(schema.reviewAttempts.userId, user.id), eq(schema.reviewAttempts.idempotencyKey, idempotencyKey)))
    .limit(1);
  if (existing?.gradingStatus === "succeeded") {
    revalidatePath("/dashboard");
    revalidatePath("/review");
    return;
  }

  const grading = await gradeReviewAnswer({
    userId: user.id,
    conceptId: concept.id,
    prompt: promptSnapshot,
    answer,
  });
  const transition = transitionMastery({
    currentState: concept.masteryState,
    currentIntervalDays: concept.intervalDays,
    result: grading.result as ReviewResult,
    gradingStatus: grading.gradingStatus,
  });

  const values = {
    userId: user.id,
    mistakeConceptId: concept.id,
    mistakePatternId: pattern?.id,
    reviewExerciseType: promptSnapshot.type,
    promptSnapshot,
    answer,
    score: grading.score,
    result: grading.result,
    feedbackVi: grading.feedbackVi,
    gradingStatus: grading.gradingStatus,
    previousMasteryState: concept.masteryState,
    nextMasteryState: transition.nextState,
    previousIntervalDays: concept.intervalDays,
    nextIntervalDays: transition.nextIntervalDays,
    idempotencyKey,
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    if (existing) {
      await tx
        .update(schema.reviewAttempts)
        .set(values)
        .where(and(eq(schema.reviewAttempts.id, existing.id), eq(schema.reviewAttempts.userId, user.id)));
    } else {
      await tx.insert(schema.reviewAttempts).values(values).onConflictDoNothing();
    }

    if (grading.gradingStatus === "succeeded" && transition.shouldSchedule) {
      await tx
        .update(schema.mistakeConcepts)
        .set({
          masteryState: transition.nextState,
          intervalDays: transition.nextIntervalDays,
          dueAt: nextDueDate(transition.nextIntervalDays),
          lastReviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(schema.mistakeConcepts.id, concept.id), eq(schema.mistakeConcepts.userId, user.id)));
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/review");
}
