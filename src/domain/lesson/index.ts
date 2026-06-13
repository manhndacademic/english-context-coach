import { db } from "@/db";
import { DrizzleLessonRepository } from "./adapters/drizzle-repository";
import { GeminiGenerationEngine } from "./adapters/gemini-generation";
import { DefaultLessonGenerationEngine } from "./engine";
import { getLLMProvider } from "@/domain/ai";
import { getTextProcessor } from "@/domain/text";
import type { LessonRepository, GenerationEngine, LessonGenerationEngine } from "./ports";

let cachedRepo: LessonRepository | null = null;
let cachedEngine: LessonGenerationEngine | null = null;

export function getLessonRepository(): LessonRepository {
  if (!cachedRepo) {
    cachedRepo = new DrizzleLessonRepository(db, getTextProcessor());
  }
  return cachedRepo;
}

export function getGenerationEngine(userId?: string, lessonId?: string): GenerationEngine {
  return new GeminiGenerationEngine(getLLMProvider(), userId, lessonId);
}

export function getLessonGenerationEngine(): LessonGenerationEngine {
  if (!cachedEngine) {
    const repo = getLessonRepository();
    const genEngine = getGenerationEngine();
    cachedEngine = new DefaultLessonGenerationEngine(repo, genEngine, getTextProcessor());
  }
  return cachedEngine;
}

export type {
  LessonRepository,
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
export { DrizzleLessonRepository } from "./adapters/drizzle-repository";
export { GeminiGenerationEngine } from "./adapters/gemini-generation";
export { DefaultLessonGenerationEngine } from "./engine";

export {
  dedupeKeyPhrases,
  prepareAnalysisForSave,
  exerciseCompletenessIssues,
  assertCompleteExercises,
  findMatchingLessonFocus,
} from "./rules";
