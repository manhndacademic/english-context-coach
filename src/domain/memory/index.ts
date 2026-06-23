import { llmProvider } from "@/domain/ai";
import { getTextProcessor } from "@/domain/text";
import { notifyJobQueued } from "@/lib/jobs/trigger";
import {
  DrizzleAttemptRepository,
  DrizzleExerciseRepository,
  DrizzleMemoryLessonLookup,
  DrizzleMistakePatternRepository,
  DrizzlePhrasePracticeRepository,
  DrizzlePracticeHistoryRepository,
  DrizzleTransactionCoordinator,
} from "./adapters/drizzle-repositories";
import { GeminiReviewPromptGenerator } from "./adapters/gemini-review-generator";
import { DefaultLearnerMemoryEngine } from "./engine";
import { DefaultGradingEngine } from "./grading/engine";
import type {
  AttemptRepository,
  ExerciseRepository,
  MistakePatternRepository,
  PhrasePracticeRepository,
  PracticeHistoryRepository,
  TransactionCoordinator,
} from "./ports";
import type { LearnerMemoryEngine } from "./types";

let cachedEngine: LearnerMemoryEngine | null = null;
let cachedExerciseRepo: ExerciseRepository | null = null;
let cachedAttemptRepo: AttemptRepository | null = null;
let cachedMistakePatternRepo: MistakePatternRepository | null = null;
let cachedPhrasePracticeRepo: PhrasePracticeRepository | null = null;
let cachedTxCoordinator: TransactionCoordinator | null = null;
let cachedPracticeHistoryRepo: PracticeHistoryRepository | null = null;

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

export function getPhrasePracticeRepository(): PhrasePracticeRepository {
  if (!cachedPhrasePracticeRepo) {
    cachedPhrasePracticeRepo = new DrizzlePhrasePracticeRepository();
  }
  return cachedPhrasePracticeRepo;
}

export function getTransactionCoordinator(): TransactionCoordinator {
  if (!cachedTxCoordinator) {
    cachedTxCoordinator = new DrizzleTransactionCoordinator();
  }
  return cachedTxCoordinator;
}

export function getPracticeHistoryRepository(): PracticeHistoryRepository {
  if (!cachedPracticeHistoryRepo) {
    cachedPracticeHistoryRepo = new DrizzlePracticeHistoryRepository();
  }
  return cachedPracticeHistoryRepo;
}

export function getLearnerMemoryEngine(): LearnerMemoryEngine {
  if (!cachedEngine) {
    const exerciseRepo = getExerciseRepository();
    const attemptRepo = getAttemptRepository();
    const mistakePatternRepo = getMistakePatternRepository();
    const phrasePracticeRepo = getPhrasePracticeRepository();
    const txCoordinator = getTransactionCoordinator();
    const lessonRepo = new DrizzleMemoryLessonLookup();
    const llm = llmProvider;
    const grader = new DefaultGradingEngine(llm);
    const reviewGenerator = new GeminiReviewPromptGenerator(llm);
    cachedEngine = new DefaultLearnerMemoryEngine(
      exerciseRepo,
      attemptRepo,
      mistakePatternRepo,
      phrasePracticeRepo,
      txCoordinator,
      lessonRepo,
      grader,
      notifyJobQueued,
      reviewGenerator,
      getTextProcessor()
    );
  }
  return cachedEngine;
}

export { DefaultLearnerMemoryEngine } from "./engine";
export { ExercisePractice } from "./exercise-practice";
export type { ExercisePracticeData } from "./exercise-practice";
export { MistakePattern } from "./mistake-pattern";
export type { MistakePatternPlain } from "./mistake-pattern";
export { PhrasePractice } from "./phrase-practice";
export type { PhrasePracticePlain } from "./phrase-practice";
export type {
  AttemptRepository,
  ExerciseRepository,
  GradingEngine,
  LearnerGradingResult,
  MistakePatternRepository,
  PhrasePracticeRepository,
  PracticeHistoryRepository,
  TransactionCoordinator,
} from "./ports";
export type {
  Attempt,
  AttemptFormResult,
  LearnerMemoryEngine,
  MasteryState,
  PhrasePracticeFormResult,
  ReviewAttempt,
  ReviewFormResult,
  SubmitAttemptInput,
  SubmitPhrasePracticeInput,
  SubmitReviewAttemptInput,
  UserError,
} from "./types";
