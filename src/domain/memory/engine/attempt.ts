import type { TextProcessor } from "@/domain/text";
import type {
  KeyPhraseCategory,
  LessonFocusCategory,
  MistakePatternStatus,
} from "@/domain/types";
import { MistakePattern } from "../mistake-pattern";
import type {
  AttemptRepository,
  MistakePatternRepository,
  MemoryLessonLookup,
  GradableExerciseInstance,
  LearnerGradingResult,
} from "../ports";
import type { Attempt } from "../types";

export const MIN_USER_ERROR_CONFIDENCE = 70;

export type MemoryCategory = KeyPhraseCategory;

export type ResolvedMemoryConcept = {
  keyPhraseId: string | null;
  lessonFocusId: string | null;
  conceptKey: string;
  conceptPhrase: string;
  conceptMeaningVi: string;
  normalizedPhrase: string;
  senseKey: string;
  category: MemoryCategory;
  explanationVi: string;
  safeReviewPromptVi: string;
  isSensitive: boolean;
  draftPhrase: string | null;
};

export function categoryForLessonFocus(
  category: LessonFocusCategory
): MemoryCategory {
  if (category === "structure") return "grammar_pattern";
  if (category === "tone") return "business_phrase";
  return "general_phrase";
}

export function shouldCreateUserError(grade: LearnerGradingResult): boolean {
  return Boolean(
    !grade.isCorrect &&
    grade.error?.shouldSave &&
    grade.error.confidence >= MIN_USER_ERROR_CONFIDENCE &&
    grade.error.errorType
  );
}

export async function resolveMemoryConcept(
  input: {
    userId: string;
    lessonId: string;
    exercise: GradableExerciseInstance;
    answer: string;
    grade: LearnerGradingResult;
  },
  lessonRepo: MemoryLessonLookup,
  textProcessor: TextProcessor
): Promise<ResolvedMemoryConcept> {
  const keyPhrase = input.exercise.keyPhraseId
    ? await lessonRepo.findKeyPhrase(input.exercise.keyPhraseId)
    : null;
  const lessonFocus = input.exercise.lessonFocusId
    ? await lessonRepo.findLessonFocus(input.exercise.lessonFocusId)
    : null;
  const correctionItem = input.exercise.correctionItemId
    ? await lessonRepo.findCorrectionItem(input.exercise.correctionItemId)
    : null;

  const errorData = input.grade.error!;
  const fallbackTarget =
    correctionItem?.correctedPhrase ??
    input.exercise.correctAnswer ??
    input.exercise.promptEn ??
    input.exercise.promptVi;
  const targetItem = fallbackTarget || errorData.targetItem || "";
  const normalizedPhrase =
    keyPhrase?.normalizedPhrase ??
    textProcessor.normalizePhrase(
      correctionItem?.correctedPhrase ?? lessonFocus?.title ?? targetItem
    );
  const senseKey =
    keyPhrase?.senseKey ??
    textProcessor.normalizePhrase(
      correctionItem
        ? `exercise:${correctionItem.correctedPhrase}`
        : `${lessonFocus?.category ?? "exercise"}:${lessonFocus?.title ?? targetItem}`
    );
  const category =
    keyPhrase?.category ??
    (correctionItem?.category as any) ??
    (lessonFocus
      ? categoryForLessonFocus(lessonFocus.category as any)
      : "general_phrase");
  const meaningVi =
    keyPhrase?.meaningVi ??
    correctionItem?.explanationVi ??
    lessonFocus?.explanationVi ??
    errorData.explanationVi ??
    "Ôn lại nghĩa tự nhiên trong ngữ cảnh.";
  const explanationVi = errorData.explanationVi ?? input.grade.feedbackVi;
  const conceptKey =
    keyPhrase?.conceptKey ??
    lessonFocus?.conceptKey ??
    correctionItem?.correctedPhrase ??
    textProcessor.normalizePhrase(targetItem);
  const conceptPhrase =
    keyPhrase?.conceptPhrase ??
    lessonFocus?.conceptPhrase ??
    correctionItem?.correctedPhrase ??
    normalizedPhrase;
  const conceptMeaningVi =
    keyPhrase?.conceptMeaningVi ?? lessonFocus?.conceptMeaningVi ?? meaningVi;
  const safeReviewPromptVi = `Ôn lại cụm "${conceptPhrase}" theo nghĩa tự nhiên trong ngữ cảnh.`;
  const originalPhrase =
    keyPhrase?.phrase ??
    correctionItem?.draftPhrase ??
    lessonFocus?.title ??
    targetItem;

  const isSensitive =
    Boolean(keyPhrase?.isSensitive) ||
    textProcessor.shouldScrubMistakePattern({
      phrase: originalPhrase,
      meaningVi: conceptMeaningVi,
      safeReviewPromptVi,
    });

  return {
    keyPhraseId: keyPhrase?.id ?? null,
    lessonFocusId: lessonFocus ? lessonFocus.id : null,
    conceptKey,
    conceptPhrase,
    conceptMeaningVi,
    normalizedPhrase,
    senseKey,
    category,
    explanationVi,
    safeReviewPromptVi,
    isSensitive,
    draftPhrase: correctionItem?.draftPhrase ?? null,
  };
}

export async function applyAttemptMemoryTransition(
  input: {
    userId: string;
    lessonId: string;
    exercise: GradableExerciseInstance;
    answer: string;
    grade: LearnerGradingResult;
  },
  repos: {
    attempts: AttemptRepository;
    mistakePatterns: MistakePatternRepository;
  },
  lessonRepo: MemoryLessonLookup,
  textProcessor: TextProcessor,
  createId: () => string
): Promise<{
  attempt: Attempt;
  userErrorCreated: boolean;
  mistakePatternStatus: MistakePatternStatus;
  reviewPromptJob?: { patternId: string };
}> {
  const attempt = await repos.attempts.createAttempt({
    exerciseId: input.exercise.id,
    lessonId: input.lessonId,
    userId: input.userId,
    answer: input.answer,
    score: input.grade.score,
    isCorrect: input.grade.isCorrect,
    feedbackVi: input.grade.feedbackVi,
    gradingMetadata: input.grade,
  });

  if (!shouldCreateUserError(input.grade)) {
    if (input.grade.isCorrect) {
      const previousAttempts = await repos.attempts.findAttemptsByExercise(
        input.exercise.id,
        input.userId
      );
      const incorrectAttempts = previousAttempts.filter(
        (a) => !a.isCorrect && a.id !== attempt.id
      );

      if (incorrectAttempts.length > 0) {
        for (const prev of incorrectAttempts) {
          const deletedError = await repos.attempts.deleteUserErrorByAttemptId(
            prev.id
          );
          if (deletedError) {
            await repos.mistakePatterns.decrementOrDeleteMistakePattern(
              input.userId,
              deletedError.conceptKey,
              deletedError.errorType
            );
          }
        }
      }
    }

    return {
      attempt,
      userErrorCreated: false,
      mistakePatternStatus: "none",
    };
  }

  const errorData = input.grade.error!;
  const memory = await resolveMemoryConcept(input, lessonRepo, textProcessor);

  if (memory.isSensitive) {
    await repos.attempts.createUserError({
      userId: input.userId,
      attemptId: attempt.id,
      lessonId: input.lessonId,
      keyPhraseId: memory.keyPhraseId,
      lessonFocusId: memory.lessonFocusId,
      errorType: errorData.errorType!,
      conceptKey: memory.conceptKey,
      normalizedPhrase: memory.conceptPhrase,
      senseKey: memory.senseKey,
      explanationVi: memory.explanationVi,
      isSourceSensitive: true,
      isRepeated: false,
    });

    return {
      attempt,
      userErrorCreated: true,
      mistakePatternStatus: "none",
    };
  }

  const existingPattern = await repos.mistakePatterns.findPatternByConcept(
    input.userId,
    memory.conceptKey,
    errorData.errorType!
  );
  const isRepeated = !!existingPattern;

  await repos.attempts.createUserError({
    userId: input.userId,
    attemptId: attempt.id,
    lessonId: input.lessonId,
    keyPhraseId: memory.keyPhraseId,
    lessonFocusId: memory.lessonFocusId,
    errorType: errorData.errorType!,
    conceptKey: memory.conceptKey,
    normalizedPhrase: memory.conceptPhrase,
    senseKey: memory.senseKey,
    explanationVi: memory.explanationVi,
    isSourceSensitive: false,
    isRepeated,
  });

  let pattern: MistakePattern;
  if (existingPattern) {
    existingPattern.incrementOccurrence();
    await repos.mistakePatterns.saveMistakePattern(existingPattern);
    pattern = existingPattern;
  } else {
    pattern = MistakePattern.createNew({
      id: createId(),
      userId: input.userId,
      conceptKey: memory.conceptKey,
      normalizedPhrase: memory.conceptPhrase,
      senseKey: memory.senseKey,
      category: memory.category,
      errorType: errorData.errorType!,
      meaningVi: memory.conceptMeaningVi,
      safeReviewPromptVi: memory.safeReviewPromptVi,
      isSensitive: false,
      draftPhrase: memory.draftPhrase,
    });
    pattern = await repos.mistakePatterns.upsertMistakePattern(pattern);
  }

  return {
    attempt,
    userErrorCreated: true,
    mistakePatternStatus: isRepeated ? "repeated" : "new",
    reviewPromptJob: pattern.needsReviewPromptGeneration()
      ? { patternId: pattern.id }
      : undefined,
  };
}
