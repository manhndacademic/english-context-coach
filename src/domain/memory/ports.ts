import type { Exercise, KeyPhrase, LessonFocus } from "@/domain/lesson/ports";
import type { Attempt, UserError, MistakePattern, ReviewAttempt } from "./types";
import type { GradingResult } from "@/lib/ai/schemas";

export interface LearnerMemoryRepository {
  findExercise(exerciseId: string, userId: string): Promise<Exercise | null>;
  findMistakePattern(patternId: string, userId: string): Promise<MistakePattern | null>;
  findPatternByConcept(userId: string, conceptKey: string, errorType: string): Promise<MistakePattern | null>;
  findKeyPhrase(keyPhraseId: string): Promise<KeyPhrase | null>;
  findLessonFocus(lessonFocusId: string): Promise<LessonFocus | null>;

  runInTransaction<T>(operation: (tx: LearnerMemoryRepository) => Promise<T>): Promise<T>;

  createAttempt(attempt: {
    exerciseId: string;
    lessonId: string;
    userId: string;
    answer: string;
    score: number;
    isCorrect: boolean;
    feedbackVi: string;
    gradingMetadata: any;
  }): Promise<Attempt>;

  createUserError(error: {
    userId: string;
    attemptId: string;
    lessonId: string;
    keyPhraseId: string | null;
    lessonFocusId: string | null;
    errorType: string;
    conceptKey: string;
    normalizedPhrase: string;
    senseKey: string;
    explanationVi: string;
    isSourceSensitive: boolean;
    isRepeated: boolean;
  }): Promise<UserError>;

  upsertMistakePattern(input: {
    userId: string;
    conceptKey: string;
    normalizedPhrase: string;
    senseKey: string | null;
    category: "idiom" | "phrasal_verb" | "technical_term" | "collocation" | "grammar_pattern" | "business_phrase" | "general_phrase";
    errorType: "literal_translation" | "phrase_misunderstanding" | "technical_term_misunderstanding" | "phrasal_verb_error" | "collocation_error" | "grammar_structure_misread" | "pronoun_reference_misread" | "tone_register_misread" | "missing_context";
    meaningVi: string;
    safeReviewPromptVi: string;
    isSensitive: boolean;
  }): Promise<MistakePattern>;

  updateMistakePatternSchedule(
    patternId: string,
    updates: {
      intervalDays: number;
      dueAt: Date;
      lastReviewedAt?: Date;
    }
  ): Promise<void>;

  createReviewAttempt(attempt: {
    userId: string;
    mistakePatternId: string;
    answer: string;
    score: number;
    isCorrect: boolean;
    feedbackVi: string;
  }): Promise<ReviewAttempt>;

  findDueMistakePatterns(userId: string, dueAt: Date, limit: number): Promise<MistakePattern[]>;
  getDashboardMetrics(userId: string, dueAt: Date): Promise<{
    dueCount: number;
    patternCount: number;
    repeatedMistakes: MistakePattern[];
  }>;

  findMistakePatternById(patternId: string): Promise<MistakePattern | null>;
  updateMistakePatternReviewPrompt(
    patternId: string,
    prompts: {
      reviewPromptEn: string;
      reviewPromptVi: string;
      reviewRubricVi: string;
      reviewCorrectAnswer: string;
      reviewAcceptableAnswers: string[];
    }
  ): Promise<void>;
}

export interface GradingEngine {
  grade(input: {
    userId: string;
    lessonId?: string;
    exercise: Exercise;
    answer: string;
  }): Promise<GradingResult>;
}

export interface JobDispatcher {
  triggerReviewPromptGeneration(mistakePatternId: string): Promise<void>;
}

export interface ReviewPromptGenerator {
  generate(input: {
    userId: string;
    conceptPhrase: string;
    conceptMeaningVi: string;
    category: string;
    errorType: string;
  }): Promise<{
    reviewPromptEn: string;
    reviewPromptVi: string;
    reviewRubricVi: string;
    reviewCorrectAnswer: string;
    reviewAcceptableAnswers: string[];
  }>;
}
