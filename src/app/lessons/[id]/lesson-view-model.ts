// Pure data-transformation functions extracted from the lesson page component.
// No side-effects, no framework dependencies – safe to import in any context.

export type AttemptLike = {
  exerciseId: string;
  isCorrect: boolean | null;
};

export type ExerciseLike = {
  id: string;
  keyPhraseId: string | null;
  lessonFocusId: string | null;
};

export type UserErrorLike = {
  attemptId: string | null;
};

export type LessonLike = { inputMode: string };

/**
 * Groups attempts by their exerciseId, preserving insertion order within each group.
 */
export function groupAttemptsByExercise<T extends AttemptLike>(
  attempts: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const attempt of attempts) {
    const existing = map.get(attempt.exerciseId) ?? [];
    existing.push(attempt);
    map.set(attempt.exerciseId, existing);
  }
  return map;
}

/**
 * Builds a lookup Map keyed by the `id` field of each item.
 * When duplicate ids exist, the last item wins.
 */
export function indexById<T extends { id: string }>(
  items: T[]
): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/**
 * Combines exercises with their associated attempts, key-phrases, and lesson-focuses
 * into the stepper item shape expected by ExerciseStepper.
 */
export function buildStepperItems<
  E extends ExerciseLike,
  A extends AttemptLike,
  P extends { id: string },
  F extends { id: string },
>(
  exercises: E[],
  attemptsByExercise: Map<string, A[]>,
  phraseById: Map<string, P>,
  focusById: Map<string, F>
) {
  return exercises.map((exercise) => {
    const latestAttempt = attemptsByExercise.get(exercise.id)?.[0];
    return {
      exercise,
      attempts: attemptsByExercise.get(exercise.id) ?? [],
      isSolved: Boolean(latestAttempt?.isCorrect),
      needsRetry: Boolean(latestAttempt && !latestAttempt.isCorrect),
      keyPhrase: exercise.keyPhraseId
        ? phraseById.get(exercise.keyPhraseId)
        : undefined,
      lessonFocus: exercise.lessonFocusId
        ? focusById.get(exercise.lessonFocusId)
        : undefined,
    };
  });
}

/**
 * Indexes user-errors by their attemptId for O(1) look-up.
 * Errors without an attemptId are skipped.
 */
export function indexUserErrorsByAttemptId<T extends UserErrorLike>(
  userErrors: T[]
): Record<string, T> {
  const map: Record<string, T> = {};
  for (const err of userErrors) {
    if (err.attemptId) {
      map[err.attemptId] = err;
    }
  }
  return map;
}

/**
 * Derives boolean flags from the lesson's inputMode string.
 */
export function classifyInputMode(inputMode: string) {
  return {
    isNotEnglishOrUnsupported:
      inputMode === "not_english" || inputMode === "unsupported",
    isDeveloperError: inputMode === "developer_error_explanation",
    isGrammarCorrection:
      inputMode === "fix_and_understand" || inputMode === "naturalize_english",
    isMixedLanguage: inputMode === "mixed_language_support",
  };
}
