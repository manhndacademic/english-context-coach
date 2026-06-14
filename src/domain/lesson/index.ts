import { db } from "@/db";
import { DrizzleSourceTextRepository } from "./adapters/drizzle-source-text-repo";
import { DrizzleLessonRepository } from "./adapters/drizzle-lesson-repo";
import { DrizzleGenerationJobRepository } from "./adapters/drizzle-generation-job-repo";
import { DrizzleGenerationProgressRepository } from "./adapters/drizzle-generation-progress-repo";
import { DrizzleLessonTransactionCoordinator } from "./adapters/drizzle-transaction-coordinator";
import { GeminiGenerationEngine } from "./adapters/gemini-generation";
import { DefaultLessonGenerationEngine } from "./engine";
import { getLLMProvider } from "@/domain/ai";
import { getTextProcessor } from "@/domain/text";
import type {
  SourceTextRepository,
  LessonRepository,
  GenerationJobRepository,
  GenerationProgressRepository,
  LessonTransactionCoordinator,
  GenerationEngine,
  LessonGenerationEngine,
} from "./ports";

let cachedSourceTexts: SourceTextRepository | null = null;
let cachedLessons: LessonRepository | null = null;
let cachedGenerationJobs: GenerationJobRepository | null = null;
let cachedGenerationProgress: GenerationProgressRepository | null = null;
let cachedTxCoordinator: LessonTransactionCoordinator | null = null;
let cachedEngine: LessonGenerationEngine | null = null;

export function getSourceTextRepository(): SourceTextRepository {
  if (!cachedSourceTexts) {
    cachedSourceTexts = new DrizzleSourceTextRepository(db, getTextProcessor());
  }
  return cachedSourceTexts;
}

export function getLessonRepository(): LessonRepository {
  if (!cachedLessons) {
    cachedLessons = new DrizzleLessonRepository(db, getTextProcessor());
  }
  return cachedLessons;
}

export function getGenerationJobRepository(): GenerationJobRepository {
  if (!cachedGenerationJobs) {
    cachedGenerationJobs = new DrizzleGenerationJobRepository(db);
  }
  return cachedGenerationJobs;
}

export function getGenerationProgressRepository(): GenerationProgressRepository {
  if (!cachedGenerationProgress) {
    cachedGenerationProgress = new DrizzleGenerationProgressRepository(db, getTextProcessor());
  }
  return cachedGenerationProgress;
}

export function getLessonTransactionCoordinator(): LessonTransactionCoordinator {
  if (!cachedTxCoordinator) {
    cachedTxCoordinator = new DrizzleLessonTransactionCoordinator(db, getTextProcessor());
  }
  return cachedTxCoordinator;
}

export function getGenerationEngine(userId?: string, lessonId?: string): GenerationEngine {
  return new GeminiGenerationEngine(getLLMProvider(), userId, lessonId);
}

export function getLessonGenerationEngine(): LessonGenerationEngine {
  if (!cachedEngine) {
    cachedEngine = new DefaultLessonGenerationEngine(
      getSourceTextRepository(),
      getLessonRepository(),
      getGenerationJobRepository(),
      getGenerationProgressRepository(),
      getLessonTransactionCoordinator(),
      getGenerationEngine(),
      getTextProcessor()
    );
  }
  return cachedEngine;
}

export type {
  SourceTextRepository,
  LessonRepository,
  GenerationJobRepository,
  GenerationProgressRepository,
  LessonTransactionCoordinator,
  GenerationEngine,
  LessonGenerationEngine,
  LessonGenerationResult,
  JobProcessResult,
  GenerationProgress,
  KeyPhrase,
  Lesson,
  Exercise,
  SourceText,
  SentenceBreakdown,
  LessonFocus,
} from "./ports";

export { DrizzleSourceTextRepository } from "./adapters/drizzle-source-text-repo";
export { DrizzleLessonRepository } from "./adapters/drizzle-lesson-repo";
export { DrizzleGenerationJobRepository } from "./adapters/drizzle-generation-job-repo";
export { DrizzleGenerationProgressRepository } from "./adapters/drizzle-generation-progress-repo";
export { DrizzleLessonTransactionCoordinator } from "./adapters/drizzle-transaction-coordinator";
export { GeminiGenerationEngine } from "./adapters/gemini-generation";
export { DefaultLessonGenerationEngine } from "./engine";

export {
  dedupeKeyPhrases,
  prepareAnalysisForSave,
  exerciseCompletenessIssues,
  assertCompleteExercises,
  findMatchingLessonFocus,
} from "./rules";
