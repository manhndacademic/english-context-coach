import crypto from "crypto";
import type {
  Exercise,
  LessonFocus,
  LessonRepository,
} from "@/domain/lesson/ports";
import type { TextProcessor } from "@/domain/text";
import { MistakePattern } from "./mistake-pattern";
import type {
  AttemptRepository,
  MistakePatternRepository,
  LearnerGradingResult,
} from "./ports";
import type { Attempt } from "./types";

export const MIN_USER_ERROR_CONFIDENCE = 70;

type MemoryCategory =
  | "idiom"
  | "phrasal_verb"
  | "technical_term"
  | "collocation"
  | "grammar_pattern"
  | "business_phrase"
  | "general_phrase";

type TransitionRepositories = {
  attempts: AttemptRepository;
  mistakePatterns: MistakePatternRepository;
};

export type AttemptMemoryTransitionInput = {
  userId: string;
  lessonId: string;
  exercise: Exercise;
  answer: string;
  grade: LearnerGradingResult;
};

export type AttemptMemoryTransitionResult = {
  attempt: Attempt;
  userErrorCreated: boolean;
  mistakePatternStatus: "new" | "repeated" | "none";
  reviewPromptJob?: { patternId: string };
};

type ResolvedMemoryConcept = {
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
};

function categoryForLessonFocus(
  category: "tone" | "structure" | "purpose" | "context"
): MemoryCategory {
  if (category === "structure") return "grammar_pattern";
  if (category === "tone") return "business_phrase";
  return "general_phrase";
}

export class AttemptMemoryTransition {
  constructor(
    private lessonRepo: LessonRepository,
    private textProcessor: TextProcessor,
    private createId: () => string = () => crypto.randomUUID()
  ) {}

  async apply(
    input: AttemptMemoryTransitionInput,
    repos: TransitionRepositories
  ): Promise<AttemptMemoryTransitionResult> {
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

    if (!this.shouldCreateUserError(input.grade)) {
      return {
        attempt,
        userErrorCreated: false,
        mistakePatternStatus: "none",
      };
    }

    const errorData = input.grade.error!;
    const memory = await this.resolveMemoryConcept(input);

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
        id: this.createId(),
        userId: input.userId,
        conceptKey: memory.conceptKey,
        normalizedPhrase: memory.conceptPhrase,
        senseKey: memory.senseKey,
        category: memory.category,
        errorType: errorData.errorType,
        meaningVi: memory.conceptMeaningVi,
        safeReviewPromptVi: memory.safeReviewPromptVi,
        isSensitive: false,
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

  private shouldCreateUserError(grade: LearnerGradingResult): boolean {
    return Boolean(
      !grade.isCorrect &&
      grade.error?.shouldSave &&
      grade.error.confidence >= MIN_USER_ERROR_CONFIDENCE &&
      grade.error.errorType
    );
  }

  private async resolveMemoryConcept(
    input: AttemptMemoryTransitionInput
  ): Promise<ResolvedMemoryConcept> {
    const keyPhrase = input.exercise.keyPhraseId
      ? await this.lessonRepo.findKeyPhrase(input.exercise.keyPhraseId)
      : null;
    const lessonFocus = input.exercise.lessonFocusId
      ? await this.lessonRepo.findLessonFocus(input.exercise.lessonFocusId)
      : null;
    const errorData = input.grade.error!;
    const fallbackTarget =
      input.exercise.correctAnswer ??
      input.exercise.promptEn ??
      input.exercise.promptVi;
    const targetItem = fallbackTarget || errorData.targetItem || "";
    const normalizedPhrase =
      keyPhrase?.normalizedPhrase ??
      this.textProcessor.normalizePhrase(lessonFocus?.title ?? targetItem);
    const senseKey =
      keyPhrase?.senseKey ??
      this.textProcessor.normalizePhrase(
        `${lessonFocus?.category ?? "exercise"}:${lessonFocus?.title ?? targetItem}`
      );
    const category =
      keyPhrase?.category ??
      (lessonFocus
        ? categoryForLessonFocus(lessonFocus.category)
        : "general_phrase");
    const meaningVi =
      keyPhrase?.meaningVi ??
      lessonFocus?.explanationVi ??
      errorData.explanationVi ??
      "Ôn lại nghĩa tự nhiên trong ngữ cảnh.";
    const explanationVi = errorData.explanationVi ?? input.grade.feedbackVi;
    const conceptKey =
      keyPhrase?.conceptKey ??
      lessonFocus?.conceptKey ??
      this.textProcessor.normalizePhrase(targetItem);
    const conceptPhrase =
      keyPhrase?.conceptPhrase ??
      lessonFocus?.conceptPhrase ??
      normalizedPhrase;
    const conceptMeaningVi =
      keyPhrase?.conceptMeaningVi ?? lessonFocus?.conceptMeaningVi ?? meaningVi;
    const safeReviewPromptVi = `Ôn lại cụm "${conceptPhrase}" theo nghĩa tự nhiên trong ngữ cảnh.`;
    const isSensitive =
      Boolean(keyPhrase?.isSensitive) ||
      this.textProcessor.shouldScrubMistakePattern({
        normalizedPhrase: conceptPhrase,
        meaningVi: conceptMeaningVi,
        safeReviewPromptVi,
      });

    return {
      keyPhraseId: keyPhrase?.id ?? null,
      lessonFocusId: lessonFocusId(lessonFocus),
      conceptKey,
      conceptPhrase,
      conceptMeaningVi,
      normalizedPhrase,
      senseKey,
      category,
      explanationVi,
      safeReviewPromptVi,
      isSensitive,
    };
  }
}

function lessonFocusId(lessonFocus: LessonFocus | null): string | null {
  return lessonFocus?.id ?? null;
}
