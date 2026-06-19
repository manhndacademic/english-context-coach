import type { MasteryState } from "@/domain/memory/types";

export interface PracticeLike {
  attempts: { id: string; isCorrect: boolean }[];
  userError?: {
    isRepeated: boolean;
    conceptKey: string;
    errorType: string;
  } | null;
  mistakePattern?: { dueAt: Date; masteryState: MasteryState } | null;
}

export interface CompletionStats {
  total: number;
  correctFirstTry: number;
  newMistakesSaved: number;
  repeatedErrors: number;
  nextReviewAt?: string;
}

export function buildCompletionStats(items: PracticeLike[]): CompletionStats {
  let correctFirstTry = 0;
  let newMistakesSaved = 0;
  let repeatedErrors = 0;
  let nextReviewAt: string | undefined;

  for (const item of items) {
    if (!item.attempts.length) continue;

    const firstAttempt = item.attempts[item.attempts.length - 1];
    if (firstAttempt?.isCorrect) correctFirstTry += 1;

    const userError = item.userError;
    if (userError) {
      if (userError.isRepeated) {
        repeatedErrors += 1;
      } else {
        newMistakesSaved += 1;
      }
    }

    const pattern = item.mistakePattern;
    if (pattern && pattern.masteryState === "active") {
      const dueStr =
        typeof pattern.dueAt === "string"
          ? pattern.dueAt
          : (pattern.dueAt as Date).toISOString();
      if (
        !nextReviewAt ||
        new Date(dueStr).getTime() < new Date(nextReviewAt).getTime()
      ) {
        nextReviewAt = dueStr;
      }
    }
  }

  return {
    total: items.length,
    correctFirstTry,
    newMistakesSaved,
    repeatedErrors,
    nextReviewAt,
  };
}
