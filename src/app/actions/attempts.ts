"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { normalizePhrase } from "@/domain/text";
import { nextDueDate } from "@/domain/review";
import { requireUser } from "@/lib/auth/guards";
import { gradeExercise } from "@/lib/grading";

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

  const grade = await gradeExercise({ userId: user.id, lessonId, exercise, answer });

  const [attempt] = await db
    .insert(schema.attempts)
    .values({
      exerciseId,
      lessonId,
      userId: user.id,
      answer,
      score: grade.score,
      isCorrect: grade.isCorrect,
      feedbackVi: grade.feedbackVi,
      gradingMetadata: grade,
    })
    .returning();

  if (!grade.isCorrect && grade.errorType) {
    const [keyPhrase] = exercise.keyPhraseId
      ? await db.select().from(schema.keyPhrases).where(eq(schema.keyPhrases.id, exercise.keyPhraseId)).limit(1)
      : [];
    const normalizedPhrase = keyPhrase?.normalizedPhrase ?? normalizePhrase(exercise.correctAnswer ?? exercise.promptEn ?? "");
    const senseKey = keyPhrase?.senseKey ?? normalizedPhrase;
    const category = keyPhrase?.category ?? "general_phrase";
    const meaningVi = keyPhrase?.meaningVi ?? "Ôn lại nghĩa của cụm này trong ngữ cảnh.";
    const explanationVi = grade.explanationVi ?? grade.feedbackVi;

    await db.transaction(async (tx) => {
      await tx.insert(schema.userErrors).values({
        userId: user.id,
        attemptId: attempt.id,
        lessonId,
        keyPhraseId: keyPhrase?.id,
        errorType: grade.errorType!,
        normalizedPhrase,
        senseKey,
        explanationVi,
        isSourceSensitive: keyPhrase?.isSensitive ?? false,
      });

      await tx
        .insert(schema.mistakePatterns)
        .values({
          userId: user.id,
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
            occurrenceCount: sql`${schema.mistakePatterns.occurrenceCount} + 1`,
            dueAt: new Date(),
            updatedAt: new Date(),
          },
        });
    });
  }

  revalidatePath(`/lessons/${lessonId}`);
  revalidatePath("/dashboard");
}
