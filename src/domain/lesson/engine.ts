import { notifyJobQueued } from "@/lib/jobs/trigger";
import {
  queue,
  retry,
  queueExerciseGeneration,
  deleteSourceText,
} from "./engine/queue";
import { processNext } from "./engine/job-runner";
import { getProgress } from "./engine/progress";
import type { TextProcessor } from "@/domain/text";
import type {
  LessonGenerationEngine as LessonGenerationEngineInterface,
  GenerationEngine,
  LessonGenerationResult,
  JobProcessResult,
  GenerationProgress,
  SourceTextRepository,
  LessonContentRepository,
  GenerationJobRepository,
  GenerationProgressRepository,
  LessonTransactionRepository,
  KeyPhrase,
} from "./ports";

interface LessonEngineCollaborators {
  notifyJobQueued(): Promise<void>;
  bulkCreateSrsCardsFromKeyPhrases(
    userId: string,
    keyPhrases: KeyPhrase[]
  ): Promise<{ inserted: number; skipped: number }>;
  scrubSensitiveContentForSourceText(
    userId: string,
    sourceTextId: string
  ): Promise<void>;
  getActiveMistakePatterns?(
    userId: string
  ): Promise<Array<{ conceptKey: string; category: string }>>;
}

const defaultCollaborators: LessonEngineCollaborators = {
  async notifyJobQueued() {
    await notifyJobQueued();
  },
  async bulkCreateSrsCardsFromKeyPhrases() {
    return { inserted: 0, skipped: 0 };
  },
  async scrubSensitiveContentForSourceText() {},
  async getActiveMistakePatterns() {
    return [];
  },
};

export class DefaultLessonGenerationEngine implements LessonGenerationEngineInterface {
  constructor(
    private sourceTexts: SourceTextRepository,
    private lessonContent: LessonContentRepository,
    private jobs: GenerationJobRepository,
    private progress: GenerationProgressRepository,
    private tx: LessonTransactionRepository,
    private genEngine: GenerationEngine,
    private textProcessor: TextProcessor,
    private collaborators: LessonEngineCollaborators = defaultCollaborators
  ) {}

  async queue(
    userId: string,
    content: string,
    requestedMode?: string,
    draftContent?: string
  ): Promise<LessonGenerationResult> {
    return queue(
      { userId, content, requestedMode, draftContent },
      {
        sourceTexts: this.sourceTexts,
        jobs: this.jobs,
        progress: this.progress,
        tx: this.tx,
        textProcessor: this.textProcessor,
        collaborators: this.collaborators,
      }
    );
  }

  async retry(
    userId: string,
    lessonId: string
  ): Promise<LessonGenerationResult> {
    return retry(
      { userId, lessonId },
      {
        lessonContent: this.lessonContent,
        jobs: this.jobs,
        progress: this.progress,
        tx: this.tx,
        collaborators: this.collaborators,
      }
    );
  }

  async queueExerciseGeneration(
    userId: string,
    lessonId: string
  ): Promise<LessonGenerationResult> {
    return queueExerciseGeneration(
      { userId, lessonId },
      {
        lessonContent: this.lessonContent,
        jobs: this.jobs,
        progress: this.progress,
        tx: this.tx,
        collaborators: this.collaborators,
      }
    );
  }

  async deleteSourceText(userId: string, sourceTextId: string): Promise<void> {
    return deleteSourceText(
      { userId, sourceTextId },
      {
        sourceTexts: this.sourceTexts,
        collaborators: this.collaborators,
      }
    );
  }

  async processNext(workerId: string): Promise<JobProcessResult> {
    return processNext(workerId, {
      sourceTexts: this.sourceTexts,
      lessonContent: this.lessonContent,
      jobs: this.jobs,
      progress: this.progress,
      genEngine: this.genEngine,
      textProcessor: this.textProcessor,
      collaborators: this.collaborators,
    });
  }

  async getProgress(
    lessonId: string,
    userId: string
  ): Promise<GenerationProgress | null> {
    return getProgress(lessonId, userId, {
      progress: this.progress,
    });
  }

  async changeContext(
    userId: string,
    lessonId: string,
    documentType?: string,
    formality?: string
  ): Promise<LessonGenerationResult> {
    const lesson = await this.lessonContent.findLesson(lessonId, userId);
    if (!lesson) {
      return {
        ok: false,
        error: "NOT_FOUND",
        message: "Lesson not found.",
      };
    }

    const result = await this.tx.changeLessonContext(
      userId,
      lessonId,
      documentType,
      formality
    );

    await Promise.all([
      this.progress.recordMilestone({
        lessonId: result.lesson.id,
        generationJobId: result.job.id,
        code: "queued",
        stage: null,
      }),
      this.collaborators.notifyJobQueued(),
    ]);

    return {
      ok: true,
      lessonId: result.lesson.id,
      sourceTextId: result.lesson.sourceTextId,
    };
  }
}
