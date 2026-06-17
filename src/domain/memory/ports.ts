import type { Exercise } from "@/domain/lesson/ports";
import type { Attempt, UserError, ReviewAttempt } from "./types";
import type { GradingResult } from "@/lib/ai/schemas";
import { MistakePattern } from "./mistake-pattern";

export type LearnerGradingResult = GradingResult & {
  systemFailure?: boolean;
};

export interface ExerciseRepository {
  findExercise(exerciseId: string, userId: string): Promise<Exercise | null>;
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
    exercise: Exercise;
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
