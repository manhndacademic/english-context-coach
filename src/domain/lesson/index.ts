import { db } from "@/db";
import { DrizzleLessonRepository } from "./adapters/drizzle-lesson-repo";
import { GeminiGenerationEngine } from "./adapters/gemini-generation";
import { DefaultLessonGenerationEngine } from "./engine";
import { getLLMProvider } from "@/domain/ai";
import { getTextProcessor } from "@/domain/text";
import type {
  LessonRepository,
  GenerationEngine,
  LessonGenerationEngine,
} from "./ports";

let cachedLessons: LessonRepository | null = null;
let cachedEngine: LessonGenerationEngine | null = null;

export function getLessonRepository(): LessonRepository {
  if (!cachedLessons) {
    cachedLessons = new DrizzleLessonRepository(db, getTextProcessor());
  }
  return cachedLessons;
}

export function getGenerationEngine(
  userId?: string,
  lessonId?: string
): GenerationEngine {
  return new GeminiGenerationEngine(getLLMProvider(), userId, lessonId);
}

export function getLessonGenerationEngine(): LessonGenerationEngine {
  if (!cachedEngine) {
    cachedEngine = new DefaultLessonGenerationEngine(
      getLessonRepository(),
      getGenerationEngine(),
      getTextProcessor()
    );
  }
  return cachedEngine;
}

export type {
  LessonRepository,
  SourceTextRepository,
  LessonContentRepository,
  GenerationJobRepository,
  GenerationProgressRepository,
  LessonTransactionRepository,
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

export { DrizzleLessonRepository } from "./adapters/drizzle-lesson-repo";
export { GeminiGenerationEngine } from "./adapters/gemini-generation";
export { DefaultLessonGenerationEngine } from "./engine";

export {
  dedupeKeyPhrases,
  prepareAnalysisForSave,
  exerciseCompletenessIssues,
  assertCompleteExercises,
  findMatchingLessonFocus,
} from "./rules";
