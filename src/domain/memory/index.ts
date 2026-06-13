import { DrizzleLearnerMemoryRepository } from "./adapters/drizzle-repository";
import { DefaultGradingEngine } from "./grading/engine";
import { QueueJobDispatcherAdapter } from "./adapters/job-dispatcher";
import { GeminiReviewPromptGenerator } from "./adapters/gemini-review-generator";
import { DefaultLearnerMemoryEngine } from "./engine";
import { getLLMProvider } from "@/domain/ai";
import { getTextProcessor } from "@/domain/text";
import { getLessonRepository } from "@/domain/lesson";
import type { LearnerMemoryEngine } from "./types";
import type { LearnerMemoryRepository } from "./ports";

let cachedEngine: LearnerMemoryEngine | null = null;
let cachedRepository: LearnerMemoryRepository | null = null;

export function getLearnerMemoryRepository(): LearnerMemoryRepository {
  if (!cachedRepository) {
    cachedRepository = new DrizzleLearnerMemoryRepository();
  }
  return cachedRepository;
}

export function getLearnerMemoryEngine(): LearnerMemoryEngine {
  if (!cachedEngine) {
    const repo = getLearnerMemoryRepository();
    const lessonRepo = getLessonRepository();
    const llm = getLLMProvider();
    const grader = new DefaultGradingEngine(llm);
    const dispatcher = new QueueJobDispatcherAdapter(() => getLearnerMemoryRepository());
    const reviewGenerator = new GeminiReviewPromptGenerator(llm);
    cachedEngine = new DefaultLearnerMemoryEngine(
      repo,
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
  MistakePattern,
  ReviewAttempt,
} from "./types";
export type { LearnerMemoryRepository, GradingEngine, JobDispatcher } from "./ports";
export { DefaultLearnerMemoryEngine } from "./engine";
