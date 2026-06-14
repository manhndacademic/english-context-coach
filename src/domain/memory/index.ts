import {
  DrizzleExerciseRepository,
  DrizzleAttemptRepository,
  DrizzleMistakePatternRepository,
  DrizzleTransactionCoordinator,
} from "./adapters/drizzle-repositories";
import { DefaultGradingEngine } from "./grading/engine";
import { QueueJobDispatcherAdapter } from "./adapters/job-dispatcher";
import { GeminiReviewPromptGenerator } from "./adapters/gemini-review-generator";
import { DefaultLearnerMemoryEngine } from "./engine";
import { getLLMProvider } from "@/domain/ai";
import { getTextProcessor } from "@/domain/text";
import { getLessonRepository } from "@/domain/lesson";
import type { LearnerMemoryEngine } from "./types";
import type {
  ExerciseRepository,
  AttemptRepository,
  MistakePatternRepository,
  TransactionCoordinator,
} from "./ports";

let cachedEngine: LearnerMemoryEngine | null = null;
let cachedExerciseRepo: ExerciseRepository | null = null;
let cachedAttemptRepo: AttemptRepository | null = null;
let cachedMistakePatternRepo: MistakePatternRepository | null = null;
let cachedTxCoordinator: TransactionCoordinator | null = null;

export function getExerciseRepository(): ExerciseRepository {
  if (!cachedExerciseRepo) {
    cachedExerciseRepo = new DrizzleExerciseRepository();
  }
  return cachedExerciseRepo;
}

export function getAttemptRepository(): AttemptRepository {
  if (!cachedAttemptRepo) {
    cachedAttemptRepo = new DrizzleAttemptRepository();
  }
  return cachedAttemptRepo;
}

export function getMistakePatternRepository(): MistakePatternRepository {
  if (!cachedMistakePatternRepo) {
    cachedMistakePatternRepo = new DrizzleMistakePatternRepository();
  }
  return cachedMistakePatternRepo;
}

export function getTransactionCoordinator(): TransactionCoordinator {
  if (!cachedTxCoordinator) {
    cachedTxCoordinator = new DrizzleTransactionCoordinator();
  }
  return cachedTxCoordinator;
}

export function getLearnerMemoryEngine(): LearnerMemoryEngine {
  if (!cachedEngine) {
    const exerciseRepo = getExerciseRepository();
    const attemptRepo = getAttemptRepository();
    const mistakePatternRepo = getMistakePatternRepository();
    const txCoordinator = getTransactionCoordinator();
    const lessonRepo = getLessonRepository();
    const llm = getLLMProvider();
    const grader = new DefaultGradingEngine(llm);
    const dispatcher = new QueueJobDispatcherAdapter(() =>
      getMistakePatternRepository()
    );
    const reviewGenerator = new GeminiReviewPromptGenerator(llm);
    cachedEngine = new DefaultLearnerMemoryEngine(
      exerciseRepo,
      attemptRepo,
      mistakePatternRepo,
      txCoordinator,
      lessonRepo,
      grader,
      dispatcher,
      reviewGenerator,
      getTextProcessor()
    );
  }
  return cachedEngine;
}

export type {
  LearnerMemoryEngine,
  SubmitAttemptInput,
  AttemptFormResult,
  SubmitReviewAttemptInput,
  ReviewFormResult,
  MasteryState,
  Attempt,
  UserError,
  ReviewAttempt,
} from "./types";
export { MistakePattern } from "./mistake-pattern";
export {
  AttemptMemoryTransition,
  MIN_USER_ERROR_CONFIDENCE,
} from "./attempt-memory-transition";
export type { MistakePatternPlain } from "./mistake-pattern";
export type {
  AttemptMemoryTransitionInput,
  AttemptMemoryTransitionResult,
} from "./attempt-memory-transition";
export type {
  ExerciseRepository,
  AttemptRepository,
  MistakePatternRepository,
  TransactionCoordinator,
  GradingEngine,
  JobDispatcher,
  LearnerGradingResult,
} from "./ports";
export { DefaultLearnerMemoryEngine } from "./engine";
