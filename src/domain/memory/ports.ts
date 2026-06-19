import type { Attempt, UserError, ReviewAttempt } from "./types";
import type { GradingResult } from "./schemas";
import { MistakePattern } from "./mistake-pattern";

export interface MemoryKeyPhraseInput {
  id: string;
  conceptKey: string;
  normalizedPhrase: string;
  senseKey: string;
  category:
    | "idiom"
    | "phrasal_verb"
    | "technical_term"
    | "collocation"
    | "grammar_pattern"
    | "business_phrase"
    | "general_phrase";
  conceptMeaningVi: string;
  isSensitive: boolean;
}

export type LearnerGradingResult = GradingResult & {
  systemFailure?: boolean;
};

export interface GradableExercise {
  type:
    | "meaning_choice"
    | "cloze_phrase"
    | "natural_translation"
    | "focus_question"
    | "trap_choice"
    | "phrase_production"
    | "dialogue_completion"
    | "register_shift"
    | "trap_detect";
  promptVi: string;
  promptEn: string | null;
  choices: string[] | null;
  correctAnswer: string | null;
  acceptableAnswers: string[] | null;
  rubricVi: string | null;
}

export interface MemoryLessonLookup {
  findKeyPhrase(keyPhraseId: string): Promise<{
    id: string;
    normalizedPhrase: string;
    senseKey: string;
    category:
      | "idiom"
      | "phrasal_verb"
      | "technical_term"
      | "collocation"
      | "grammar_pattern"
      | "business_phrase"
      | "general_phrase";
    meaningVi: string;
    conceptKey: string;
    conceptPhrase: string;
    conceptMeaningVi: string;
    phrase: string;
    isSensitive: boolean;
  } | null>;
  findLessonFocus(lessonFocusId: string): Promise<{
    id: string;
    title: string;
    category: string;
    explanationVi: string;
    conceptKey: string;
    conceptPhrase: string;
    conceptMeaningVi: string;
  } | null>;
}

export type GradableExerciseInstance = GradableExercise & {
  id: string;
  lessonId: string;
  userId: string;
  keyPhraseId: string | null;
  lessonFocusId: string | null;
  orderIndex: number;
  createdAt: Date;
};

export interface ExerciseRepository {
  findExercise(
    exerciseId: string,
    userId: string
  ): Promise<GradableExerciseInstance | null>;
}

export interface AttemptRepository {
  createAttempt(attempt: {
    exerciseId: string;
    lessonId: string;
    userId: string;
    answer: string;
    score: number;
    isCorrect: boolean;
    feedbackVi: string;
    gradingMetadata: Record<string, any> | null;
  }): Promise<Attempt>;

  createReviewAttempt(attempt: {
    userId: string;
    mistakePatternId: string;
    answer: string;
    score: number;
    isCorrect: boolean;
    feedbackVi: string;
  }): Promise<ReviewAttempt>;

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
}

export interface MistakePatternRepository {
  findMistakePattern(
    patternId: string,
    userId: string
  ): Promise<MistakePattern | null>;
  findMistakePatternById(patternId: string): Promise<MistakePattern | null>;
  findPatternByConcept(
    userId: string,
    conceptKey: string,
    errorType: string
  ): Promise<MistakePattern | null>;
  upsertMistakePattern(pattern: MistakePattern): Promise<MistakePattern>;
  saveMistakePattern(pattern: MistakePattern): Promise<void>;
  claimReviewPromptJob(workerId: string): Promise<MistakePattern | null>;
  findDueMistakePatterns(
    userId: string,
    dueAt: Date,
    limit: number
  ): Promise<MistakePattern[]>;
  findAllMistakePatterns(userId: string): Promise<MistakePattern[]>;
  bulkCreateFromKeyPhrases(
    userId: string,
    phrases: MemoryKeyPhraseInput[]
  ): Promise<{ inserted: number; skipped: number }>;
  scrubSensitiveContentForSourceText(
    userId: string,
    sourceTextId: string
  ): Promise<void>;
  getLessonsForPatterns(
    userId: string
  ): Promise<Record<string, Array<{ id: string; title: string | null }>>>;
  getDashboardMetrics(
    userId: string,
    dueAt: Date
  ): Promise<{
    dueCount: number;
    patternCount: number;
    repeatedMistakes: MistakePattern[];
    learningStreakDays: number;
    masteredCount: number;
    reviewSuccessRate: number;
    masteredTrend: Array<{ week: string; cumulative: number }>;
    exercisesCompleted: number;
    lessonsCompleted: number;
    literalErrorTrend: Array<{
      week: string;
      literalRatio: number;
      total: number;
    }>;
  }>;
}

export interface TransactionCoordinator {
  runInTransaction<T>(
    operation: (repos: {
      exercises: ExerciseRepository;
      attempts: AttemptRepository;
      mistakePatterns: MistakePatternRepository;
    }) => Promise<T>
  ): Promise<T>;
}

export interface GradingEngine {
  grade(input: {
    userId: string;
    lessonId?: string;
    exercise: GradableExercise;
    answer: string;
  }): Promise<LearnerGradingResult>;
}

export interface ReviewPromptGenerator {
  generate(input: {
    userId: string;
    conceptPhrase: string;
    conceptMeaningVi: string;
    category: string;
    errorType: string;
  }): Promise<{
    reviewType: string;
    reviewPromptEn: string;
    reviewPromptVi: string;
    reviewRubricVi: string;
    reviewCorrectAnswer: string;
    reviewAcceptableAnswers: string[];
    reviewChoices: string[] | null;
  }>;
}

export interface PracticeHistoryRepository {
  getLessonPracticeState(
    lessonId: string,
    userId: string
  ): Promise<{
    attempts: Attempt[];
    userErrors: UserError[];
    mistakePatterns: MistakePattern[];
  }>;
}
