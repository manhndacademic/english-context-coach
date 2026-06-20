import type { Attempt, UserError, ReviewAttempt } from "./types";
import type { GradingResult } from "./schemas";
import { MistakePattern } from "./mistake-pattern";
import { PhrasePractice } from "./phrase-practice";
import type { KeyPhraseCategory, ExerciseType } from "@/domain/types";

export interface MemoryKeyPhraseInput {
  id: string;
  conceptKey: string;
  normalizedPhrase: string;
  senseKey: string;
  category: KeyPhraseCategory;
  conceptMeaningVi: string;
  isSensitive: boolean;
}

export type LearnerGradingResult = GradingResult & {
  systemFailure?: boolean;
};

export interface GradableExercise {
  type: ExerciseType;
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
    category: KeyPhraseCategory;
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

  createPhrasePracticeAttempt(attempt: {
    userId: string;
    phrasePracticeId: string;
    answer: string;
    score: number;
    isCorrect: boolean;
    feedbackVi: string;
  }): Promise<any>;

  createUserError(error: {
    userId: string;
    attemptId: string | null;
    lessonId: string | null;
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

export interface PhrasePracticeRepository {
  findPhrasePractice(
    practiceId: string,
    userId: string
  ): Promise<PhrasePractice | null>;
  findPhrasePracticeById(practiceId: string): Promise<PhrasePractice | null>;
  findPracticeByConcept(
    userId: string,
    conceptKey: string,
    senseKey: string
  ): Promise<PhrasePractice | null>;
  upsertPhrasePractice(practice: PhrasePractice): Promise<PhrasePractice>;
  savePhrasePractice(practice: PhrasePractice): Promise<void>;
  claimReviewPromptJob(workerId: string): Promise<PhrasePractice | null>;
  findDuePhrasePractices(
    userId: string,
    dueAt: Date,
    limit: number
  ): Promise<PhrasePractice[]>;
  findAllPhrasePractices(userId: string): Promise<PhrasePractice[]>;
  bulkCreateFromKeyPhrases(
    userId: string,
    phrases: MemoryKeyPhraseInput[]
  ): Promise<{ inserted: number; skipped: number }>;
}

export interface TransactionCoordinator {
  runInTransaction<T>(
    operation: (repos: {
      exercises: ExerciseRepository;
      attempts: AttemptRepository;
      mistakePatterns: MistakePatternRepository;
      phrasePractices: PhrasePracticeRepository;
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
