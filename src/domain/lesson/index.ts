import { db } from "@/db";
import { DrizzleLessonRepository } from "./adapters/drizzle-lesson-repo";
import { GeminiGenerationEngine } from "./adapters/gemini-generation";
import { DefaultLessonGenerationEngine } from "./engine";
import { getLLMProvider } from "@/domain/ai";
import {
  getLearnerMemoryEngine,
  getMistakePatternRepository,
  setLessonRepositoryForMemory,
} from "@/domain/memory";
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
    setLessonRepositoryForMemory(cachedLessons);
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
    const lessonRepository = getLessonRepository();
    cachedEngine = new DefaultLessonGenerationEngine(
      lessonRepository,
      lessonRepository,
      lessonRepository,
      lessonRepository,
      lessonRepository,
      getGenerationEngine(),
      getTextProcessor(),
      {
        notifyJobQueued: async () => {
          const { notifyJobQueued } = await import("@/lib/jobs/trigger");
          await notifyJobQueued();
        },
        bulkCreateSrsCardsFromKeyPhrases: async (userId, keyPhrases) =>
          getLearnerMemoryEngine().bulkCreateSrsCardsFromKeyPhrases(
            userId,
            keyPhrases
          ),
        scrubSensitiveContentForSourceText: async (userId, sourceTextId) =>
          getMistakePatternRepository().scrubSensitiveContentForSourceText(
            userId,
            sourceTextId
          ),
      }
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

export {
  dedupeKeyPhrases,
  prepareAnalysisForSave,
  exerciseCompletenessIssues,
  assertCompleteExercises,
  findMatchingLessonFocus,
} from "./rules";
