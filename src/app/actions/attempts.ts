"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { normalizePhrase } from "@/domain/text";
import {
  buildSafeReviewSeed,
  conceptTitleVi,
  deterministicConceptKey,
  type MistakeConceptSeed,
} from "@/domain/review";
import { requireUser } from "@/lib/auth/guards";
import { gradeExercise } from "@/lib/grading";

function categoryForLessonFocus(category: typeof schema.lessonFocusCategoryEnum.enumValues[number]) {
  if (category === "structure") return "grammar_pattern" as const;
  if (category === "tone") return "business_phrase" as const;
  return "general_phrase" as const;
}

function idempotencyKeyForAttempt(input: { exerciseId: string; answer: string }) {
  const answerHash = createHash("sha256").update(input.answer).digest("hex").slice(0, 32);
  return `lesson-attempt:${input.exerciseId}:${answerHash}`;
}

export async function submitAttemptAction(formData: FormData) {
  const user = await requireUser();
  const exerciseId = String(formData.get("exerciseId") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");
  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) return;

  const [exercise] = await db
    .select()
    .from(schema.exercises)
    .where(and(eq(schema.exercises.id, exerciseId), eq(schema.exercises.userId, user.id)))
    .limit(1);
  if (!exercise) return;
  if (exercise.lessonId !== lessonId) return;

  const idempotencyKey = idempotencyKeyForAttempt({ exerciseId, answer });
  const existing = await db
    .select()
    .from(schema.attempts)
    .where(and(eq(schema.attempts.userId, user.id), eq(schema.attempts.idempotencyKey, idempotencyKey)))
    .limit(1);

  if (existing[0]?.gradingStatus === "succeeded") {
    revalidatePath(`/lessons/${lessonId}`);
    revalidatePath("/dashboard");
    return;
  }

  const attempt =
    existing[0] ??
    (
      await db
        .insert(schema.attempts)
        .values({
          exerciseId,
          lessonId,
          userId: user.id,
          answer,
          score: null,
          isCorrect: null,
          feedbackVi: "Đang chấm câu trả lời.",
          gradingStatus: "pending",
          idempotencyKey,
        })
        .onConflictDoNothing()
        .returning()
    )[0];

  if (!attempt) {
    revalidatePath(`/lessons/${lessonId}`);
    return;
  }

  const outcome = await gradeExercise({ userId: user.id, lessonId, exercise, answer });

  if (outcome.gradingStatus === "failed") {
    await db
      .update(schema.attempts)
      .set({
        score: null,
        isCorrect: null,
        feedbackVi: outcome.feedbackVi,
        gradingStatus: "failed",
        gradingMetadata: { errorClass: outcome.errorClass },
      })
      .where(and(eq(schema.attempts.id, attempt.id), eq(schema.attempts.userId, user.id)));
    revalidatePath(`/lessons/${lessonId}`);
    return;
  }

  const grade = outcome.grade;
  await db
    .update(schema.attempts)
    .set({
      score: grade.score,
      isCorrect: grade.isCorrect,
      feedbackVi: grade.feedbackVi,
      gradingStatus: "succeeded",
      gradingMetadata: grade,
    })
    .where(and(eq(schema.attempts.id, attempt.id), eq(schema.attempts.userId, user.id)));

  if (!grade.isCorrect && grade.errorType) {
    const [keyPhrase] = exercise.keyPhraseId
      ? await db.select().from(schema.keyPhrases).where(eq(schema.keyPhrases.id, exercise.keyPhraseId)).limit(1)
      : [];
    const [lessonFocus] = exercise.lessonFocusId
      ? await db.select().from(schema.lessonFocuses).where(eq(schema.lessonFocuses.id, exercise.lessonFocusId)).limit(1)
      : [];
    const [lesson] = await db
      .select()
      .from(schema.lessons)
      .where(and(eq(schema.lessons.id, lessonId), eq(schema.lessons.userId, user.id)))
      .limit(1);
    if (!lesson) return;

    const fallbackTarget = exercise.correctAnswer ?? exercise.promptEn ?? exercise.promptVi;
    const normalizedPhrase = keyPhrase?.normalizedPhrase ?? normalizePhrase(lessonFocus?.title ?? fallbackTarget);
    const senseKey = keyPhrase?.senseKey ?? normalizePhrase(`${lessonFocus?.category ?? "exercise"}:${lessonFocus?.title ?? fallbackTarget}`);
    const category = keyPhrase?.category ?? (lessonFocus ? categoryForLessonFocus(lessonFocus.category) : "general_phrase");
    const meaningVi = keyPhrase?.meaningVi ?? lessonFocus?.explanationVi ?? "Ôn lại nghĩa tự nhiên trong ngữ cảnh.";
    const explanationVi = grade.explanationVi ?? grade.feedbackVi;
    const conceptSeed: MistakeConceptSeed = {
      normalizedPhrase,
      senseKey,
      category,
      errorType: grade.errorType,
      meaningVi,
      explanationVi,
      isSensitive: keyPhrase?.isSensitive ?? false,
    };
    const conceptKey = deterministicConceptKey(conceptSeed);
    const titleVi = conceptTitleVi(conceptSeed);
    const safeReviewSeed = buildSafeReviewSeed(conceptSeed);

    await db.transaction(async (tx) => {
      const [concept] = await tx
        .insert(schema.mistakeConcepts)
        .values({
          userId: user.id,
          conceptKey,
          category,
          errorType: grade.errorType!,
          titleVi,
          explanationVi,
          safeReviewSeed,
          masteryState: "learning",
          intervalDays: 0,
          dueAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [schema.mistakeConcepts.userId, schema.mistakeConcepts.conceptKey],
          set: {
            masteryState: sql`case when ${schema.mistakeConcepts.masteryState} = 'mastered' then 'relearning'::mastery_state when ${schema.mistakeConcepts.masteryState} = 'new' then 'learning'::mastery_state else ${schema.mistakeConcepts.masteryState} end`,
            dueAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      const [pattern] = await tx
        .insert(schema.mistakePatterns)
        .values({
          userId: user.id,
          mistakeConceptId: concept.id,
          normalizedPhrase,
          senseKey,
          category,
          errorType: grade.errorType!,
          meaningVi,
          safeReviewPromptVi: `Ôn lại cụm "${normalizedPhrase}" theo nghĩa tự nhiên trong ngữ cảnh.`,
          occurrenceCount: 1,
          intervalDays: 0,
          dueAt: new Date(),
          isSensitive: keyPhrase?.isSensitive ?? false,
        })
        .onConflictDoUpdate({
          target: [
            schema.mistakePatterns.userId,
            schema.mistakePatterns.normalizedPhrase,
            schema.mistakePatterns.senseKey,
            schema.mistakePatterns.errorType,
          ],
          set: {
            mistakeConceptId: concept.id,
            occurrenceCount: sql`${schema.mistakePatterns.occurrenceCount} + 1`,
            dueAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      const [userError] = await tx
        .insert(schema.userErrors)
        .values({
          userId: user.id,
          attemptId: attempt.id,
          lessonId,
          keyPhraseId: keyPhrase?.id,
          lessonFocusId: lessonFocus?.id,
          errorType: grade.errorType!,
          normalizedPhrase,
          senseKey,
          explanationVi,
          isSourceSensitive: keyPhrase?.isSensitive ?? false,
        })
        .returning();

      await tx
        .insert(schema.mistakeEvidence)
        .values({
          userId: user.id,
          mistakeConceptId: concept.id,
          mistakePatternId: pattern.id,
          userErrorId: userError.id,
          sourceTextId: lesson.sourceTextId,
          lessonId,
        })
        .onConflictDoNothing();
    });
  }

  revalidatePath(`/lessons/${lessonId}`);
  revalidatePath("/dashboard");
}
