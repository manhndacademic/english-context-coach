export interface Attempt {
  id: string;
  exerciseId: string;
  lessonId: string;
  userId: string;
  answer: string;
  score: number;
  isCorrect: boolean;
  feedbackVi: string;
  gradingMetadata: Record<string, any> | null;
  createdAt: Date;
}

export interface UserError {
  id: string;
  userId: string;
  attemptId: string | null;
  lessonId: string | null;
  keyPhraseId?: string | null;
  lessonFocusId?: string | null;
  errorType: string;
  conceptKey: string;
  normalizedPhrase: string;
  senseKey: string;
  explanationVi: string;
  isSourceSensitive: boolean;
  isRepeated: boolean;
  createdAt: Date;
}

// MistakePattern is now a rich aggregate class defined in mistake-pattern.ts

export interface ReviewAttempt {
  id: string;
  userId: string;
  mistakePatternId: string;
  answer: string;
  score: number;
  isCorrect: boolean;
  feedbackVi: string;
  createdAt: Date;
}

export type MasteryState = "active" | "mastered";

export interface SubmitAttemptInput {
  userId: string;
  exerciseId: string;
  lessonId: string;
  answer: string;
}

export interface AttemptFormResult {
  success: boolean;
  isCorrect: boolean;
  score: number;
  feedbackVi: string;
  userErrorCreated: boolean;
  mistakePatternStatus: "new" | "repeated" | "none";
  feedbackDetails?: {
    whatWasWrong: string;
    whyItWasWrong: string;
    correctUnderstanding: string;
    mistakeType: string;
    nextPracticeItem?: string | null;
    detailedExplanation: string;
  } | null;
  error?: string;
}

export interface SubmitReviewAttemptInput {
  userId: string;
  patternId: string;
  answer: string;
}

export interface ReviewFormResult {
  success: boolean;
  isCorrect: boolean;
  score: number;
  feedbackVi: string;
  masteryStateUpdated: boolean;
  masteryState?: MasteryState;
  nextReviewAt?: Date;
  naturalAnswer?: string;
  feedbackDetails?: {
    whatWasWrong: string;
    whyItWasWrong: string;
    correctUnderstanding: string;
    mistakeType: string;
    nextPracticeItem?: string | null;
    detailedExplanation: string;
  } | null;
  error?: string;
}

export interface LearnerMemoryEngine {
  submitAttempt(input: SubmitAttemptInput): Promise<AttemptFormResult>;
  submitReviewAttempt(
    input: SubmitReviewAttemptInput
  ): Promise<ReviewFormResult>;
  generateReviewPrompt(patternId: string): Promise<void>;
  processNextReviewPromptJob(
    workerId: string
  ): Promise<
    | { status: "processed"; patternId: string; success: boolean }
    | { status: "idle" }
    | { status: "failed"; error: string }
  >;
  getDashboardMetrics(
    userId: string,
    dueAt: Date
  ): Promise<{
    dueCount: number;
    patternCount: number;
    repeatedMistakes: any[];
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
