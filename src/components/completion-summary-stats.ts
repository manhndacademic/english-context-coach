import type { MasteryState } from "@/domain/memory";

export interface CompletionAttempt {
  id: string;
  isCorrect: boolean;
}

export interface CompletionExerciseItem {
  attempts: CompletionAttempt[];
}

export interface CompletionUserErrorSummary {
  attemptId: string | null;
  conceptKey: string;
  errorType: string;
  isRepeated: boolean;
}

export interface CompletionMistakePatternSummary {
  conceptKey: string;
  errorType: string;
  dueAt: string;
  masteryState: MasteryState;
}

export interface CompletionStats {
  total: number;
  correctFirstTry: number;
  newMistakesSaved: number;
  repeatedErrors: number;
  nextReviewAt?: string;
}

function patternKey(conceptKey: string, errorType: string) {
  return `${conceptKey}:${errorType}`;
}

export function buildCompletionStats(input: {
  items: CompletionExerciseItem[];
  userErrorsByAttemptId: Map<string, CompletionUserErrorSummary>;
  mistakePatternsByKey: Map<string, CompletionMistakePatternSummary>;
}): CompletionStats {
  let correctFirstTry = 0;
  let newMistakesSaved = 0;
  let repeatedErrors = 0;
  let nextReviewAt: string | undefined;

  for (const item of input.items) {
    if (!item.attempts.length) continue;

    const firstAttempt = item.attempts[item.attempts.length - 1];
    if (firstAttempt?.isCorrect) correctFirstTry += 1;

    for (const attempt of item.attempts) {
      const userError = input.userErrorsByAttemptId.get(attempt.id);
      if (!userError) continue;

      if (userError.isRepeated) {
        repeatedErrors += 1;
      } else {
        newMistakesSaved += 1;
      }

      const pattern = input.mistakePatternsByKey.get(patternKey(userError.conceptKey, userError.errorType));
      if (!pattern || pattern.masteryState !== "active") continue;

      if (!nextReviewAt || new Date(pattern.dueAt).getTime() < new Date(nextReviewAt).getTime()) {
        nextReviewAt = pattern.dueAt;
      }
    }
  }

  return {
    total: input.items.length,
    correctFirstTry,
    newMistakesSaved,
    repeatedErrors,
    nextReviewAt,
  };
}

export { patternKey as completionMistakePatternKey };
