import { db } from "@/db";
import { llmProvider } from "@/domain/ai";
import {
  getLearnerMemoryEngine,
  getMistakePatternRepository,
} from "@/domain/memory";
import { getTextProcessor } from "@/domain/text";
import { DrizzleLessonRepository } from "./adapters/drizzle-lesson-repo";
import { GeminiGenerationEngine } from "./adapters/gemini-generation";
import { DefaultLessonGenerationEngine } from "./engine";
import type {
  GenerationEngine,
  LessonGenerationEngine,
  LessonRepository,
} from "./ports";

let cachedLessons: LessonRepository | null = null;
let cachedEngine: LessonGenerationEngine | null = null;

export function getLessonRepository(): LessonRepository {
  if (!cachedLessons) {
    cachedLessons = new DrizzleLessonRepository(db, getTextProcessor());
  }
  return cachedLessons;
}

function getGenerationEngine(
  userId?: string,
  lessonId?: string
): GenerationEngine {
  return new GeminiGenerationEngine(llmProvider, userId, lessonId);
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
        getActiveMistakePatterns: async (userId) => {
          const allPatterns =
            await getMistakePatternRepository().findAllMistakePatterns(userId);
          return allPatterns
            .filter((p) => p.masteryState === "active")
            .map((p) => ({
              conceptKey: p.conceptKey,
              category: p.category,
            }));
        },
      }
    );
  }
  return cachedEngine;
}

export type {
  Exercise,
  GenerationEngine,
  GenerationJobRepository,
  GenerationProgress,
  GenerationProgressRepository,
  JobProcessResult,
  KeyPhrase,
  Lesson,
  LessonContentRepository,
  LessonFocus,
  LessonGenerationEngine,
  LessonGenerationResult,
  LessonRepository,
  LessonTransactionRepository,
  SentenceBreakdown,
  SourceText,
  SourceTextRepository,
} from "./ports";

export {
  assertCompleteExercises,
  dedupeKeyPhrases,
  exerciseCompletenessIssues,
  findMatchingLessonFocus,
  prepareAnalysisForSave,
} from "./rules";
