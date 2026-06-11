"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { normalizePhrase } from "@/domain/text";
import {
  buildSafeReviewSeed,
  deterministicConceptKey,
  learnerSafeConceptTitleVi,
  learnerSafeExplanationVi,
  type MistakeConceptSeed,
} from "@/domain/review";
import { requireUser } from "@/lib/auth/guards";
import { gradeExercise } from "@/lib/grading";

function categoryForLessonFocus(
  category: (typeof schema.lessonFocusCategoryEnum.enumValues)[number],
) {
  if (category === "structure") return "grammar_pattern" as const;
  if (category === "tone") return "business_phrase" as const;
  return "general_phrase" as const;
}

function idempotencyKeyForAttempt(input: {
  exerciseId: string;
  submissionId: string;
}) {
  return `lesson:${input.exerciseId}:${input.submissionId}`;
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
    .where(
      and(
        eq(schema.exercises.id, exerciseId),
        eq(schema.exercises.userId, user.id),
      ),
    )
    .limit(1);
  if (!exercise) return;
  if (exercise.lessonId !== lessonId) return;

  const retryAttemptId = String(formData.get("retryAttemptId") ?? "").trim();
  const submissionId =
    String(formData.get("submissionId") ?? "").trim() || randomUUID();
  const idempotencyKey = idempotencyKeyForAttempt({ exerciseId, submissionId });

  const [retryAttempt] = retryAttemptId
    ? await db
        .select()
        .from(schema.attempts)
        .where(
          and(
            eq(schema.attempts.id, retryAttemptId),
            eq(schema.attempts.userId, user.id),
            eq(schema.attempts.exerciseId, exerciseId),
          ),
        )
        .limit(1)
    : [];

  const [existingByKey] = await db
    .select()
    .from(schema.attempts)
    .where(
      and(
        eq(schema.attempts.userId, user.id),
        eq(schema.attempts.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);

  const attempt =
    retryAttempt ??
    existingByKey ??
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

  if (attempt.gradingStatus === "succeeded") {
    revalidatePath(`/lessons/${lessonId}`);
    revalidatePath("/dashboard");
    return;
  }

  const answerToGrade = retryAttempt ? retryAttempt.answer : answer;
  const outcome = await gradeExercise({
    userId: user.id,
    lessonId,
    exercise,
    answer: answerToGrade,
  });

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
      .where(
        and(
          eq(schema.attempts.id, attempt.id),
          eq(schema.attempts.userId, user.id),
        ),
      );
    revalidatePath(`/lessons/${lessonId}`);
    return;
  }

  const grade = outcome.grade;
  if (grade.isCorrect || !grade.errorType) {
    await db
      .update(schema.attempts)
      .set({
        score: grade.score,
        isCorrect: grade.isCorrect,
        feedbackVi: grade.feedbackVi,
        gradingStatus: "succeeded",
        gradingMetadata: grade,
      })
      .where(
        and(
          eq(schema.attempts.id, attempt.id),
          eq(schema.attempts.userId, user.id),
        ),
      );
    revalidatePath(`/lessons/${lessonId}`);
    revalidatePath("/dashboard");
    return;
  }

  if (!grade.isCorrect && grade.errorType) {
    const [keyPhrase] = exercise.keyPhraseId
      ? await db
          .select()
          .from(schema.keyPhrases)
          .where(eq(schema.keyPhrases.id, exercise.keyPhraseId))
          .limit(1)
      : [];
    const [lessonFocus] = exercise.lessonFocusId
      ? await db
          .select()
          .from(schema.lessonFocuses)
          .where(eq(schema.lessonFocuses.id, exercise.lessonFocusId))
          .limit(1)
      : [];
    const [lesson] = await db
      .select()
      .from(schema.lessons)
      .where(
        and(
          eq(schema.lessons.id, lessonId),
          eq(schema.lessons.userId, user.id),
        ),
      )
      .limit(1);
    if (!lesson) return;

    const fallbackTarget =
      exercise.correctAnswer ?? exercise.promptEn ?? exercise.promptVi;
    const normalizedPhrase =
      keyPhrase?.normalizedPhrase ??
      normalizePhrase(lessonFocus?.title ?? fallbackTarget);
    const senseKey =
      keyPhrase?.senseKey ??
      normalizePhrase(
        `${lessonFocus?.category ?? "exercise"}:${lessonFocus?.title ?? fallbackTarget}`,
      );
    const category =
      keyPhrase?.category ??
      (lessonFocus
        ? categoryForLessonFocus(lessonFocus.category)
        : "general_phrase");
    const meaningVi =
      keyPhrase?.meaningVi ??
      lessonFocus?.explanationVi ??
      "Ôn lại nghĩa tự nhiên trong ngữ cảnh.";
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
    const titleVi = learnerSafeConceptTitleVi(conceptSeed);
    const safeExplanationVi = learnerSafeExplanationVi(conceptSeed);
    const safeReviewSeed = buildSafeReviewSeed(conceptSeed);

    await db.transaction(async (tx) => {
      const [currentAttempt] = await tx
        .select()
        .from(schema.attempts)
        .where(
          and(
            eq(schema.attempts.id, attempt.id),
            eq(schema.attempts.userId, user.id),
          ),
        )
        .for("update")
        .limit(1);
      if (!currentAttempt || currentAttempt.gradingStatus === "succeeded")
        return;

      const [concept] = await tx
        .insert(schema.mistakeConcepts)
        .values({
          userId: user.id,
          conceptKey,
          category,
          errorType: grade.errorType!,
          titleVi,
          explanationVi: safeExplanationVi,
          safeReviewSeed,
          masteryState: "learning",
          intervalDays: 0,
          dueAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            schema.mistakeConcepts.userId,
            schema.mistakeConcepts.conceptKey,
          ],
          set: {
            titleVi,
            explanationVi: safeExplanationVi,
            safeReviewSeed,
            masteryState: sql`case when ${schema.mistakeConcepts.masteryState} = 'mastered' then 'relearning'::mastery_state when ${schema.mistakeConcepts.masteryState} = 'new' then 'learning'::mastery_state else ${schema.mistakeConcepts.masteryState} end`,
            dueAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      const insertedErrors = await tx
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
        .onConflictDoNothing()
        .returning();
      const [userError] = insertedErrors.length
        ? insertedErrors
        : await tx
            .select()
            .from(schema.userErrors)
            .where(eq(schema.userErrors.attemptId, attempt.id))
            .limit(1);
      if (!userError)
        throw new Error("Could not persist learner error for attempt.");

      const increment = insertedErrors.length
        ? sql`${schema.mistakePatterns.occurrenceCount} + 1`
        : schema.mistakePatterns.occurrenceCount;
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
          safeReviewPromptVi: `Ôn lại điểm nghĩa này theo cách tự nhiên trong ngữ cảnh.`,
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
            occurrenceCount: increment,
            safeReviewPromptVi: `Ôn lại điểm nghĩa này theo cách tự nhiên trong ngữ cảnh.`,
            dueAt: new Date(),
            updatedAt: new Date(),
          },
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

      await tx
        .update(schema.attempts)
        .set({
          score: grade.score,
          isCorrect: grade.isCorrect,
          feedbackVi: grade.feedbackVi,
          gradingStatus: "succeeded",
          gradingMetadata: grade,
        })
        .where(
          and(
            eq(schema.attempts.id, attempt.id),
            eq(schema.attempts.userId, user.id),
          ),
        );
    });
  }

  revalidatePath(`/lessons/${lessonId}`);
  revalidatePath("/dashboard");
}
