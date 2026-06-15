import { SOURCE_TEXT_MAX_LENGTH } from "@/domain/constants";
import type { TextProcessor } from "@/domain/text";
import type {
  LessonGenerationEngine as LessonGenerationEngineInterface,
  LessonRepository,
  GenerationEngine,
  LessonGenerationResult,
  JobProcessResult,
  GenerationProgress,
} from "./ports";
import { JobExecutor, DefaultJobExecutor } from "./job-executor";

export class DefaultLessonGenerationEngine implements LessonGenerationEngineInterface {
  private jobExecutor: JobExecutor;

  constructor(
    private lessons: LessonRepository,
    genEngine: GenerationEngine,
    private textProcessor: TextProcessor,
    jobExecutor?: JobExecutor
  ) {
    this.jobExecutor =
      jobExecutor ?? new DefaultJobExecutor(lessons, genEngine, textProcessor);
  }

  async queue(
    userId: string,
    content: string,
    requestedMode?: string
  ): Promise<LessonGenerationResult> {
    const { normalized, hash: contentHash } =
      this.textProcessor.processSource(content);
    if (!normalized) {
      return {
        ok: false,
        error: "VALIDATION_FAILED",
        message: "Paste some English text first.",
      };
    }

    if (normalized.length > SOURCE_TEXT_MAX_LENGTH) {
      return {
        ok: false,
        error: "VALIDATION_FAILED",
        message: `Source text must be ${SOURCE_TEXT_MAX_LENGTH.toLocaleString()} characters or less.`,
      };
    }

    const capacityError = await this.lessons.assertQueueCapacity(userId);
    if (capacityError) {
      return {
        ok: false,
        error: "CAPACITY_EXCEEDED",
        message: capacityError,
      };
    }

    const result = await this.lessons.createSourceTextAndLessonAndJob(
      userId,
      content,
      "Untitled source",
      contentHash,
      requestedMode
    );

    await this.lessons.recordMilestone({
      lessonId: result.lesson.id,
      generationJobId: result.job.id,
      code: "queued",
      stage: null,
    });

    return {
      ok: true,
      lessonId: result.lesson.id,
      sourceTextId: result.lesson.sourceTextId,
    };
  }

  async retry(
    userId: string,
    lessonId: string
  ): Promise<LessonGenerationResult> {
    const lesson = await this.lessons.findLesson(lessonId, userId);
    if (!lesson) {
      return {
        ok: false,
        error: "NOT_FOUND",
        message: "Lesson not found.",
      };
    }

    if (
      lesson.analysisStatus === "running" ||
      lesson.exerciseStatus === "running"
    ) {
      return {
        ok: false,
        error: "INVALID_STATE",
        message: "Lesson is already generating.",
      };
    }

    const capacityError = await this.lessons.assertQueueCapacity(userId);
    if (capacityError) {
      return {
        ok: false,
        error: "CAPACITY_EXCEEDED",
        message: capacityError,
      };
    }

    // 1. If both are succeeded, it's a regeneration (create a new version)
    if (
      lesson.analysisStatus === "succeeded" &&
      lesson.exerciseStatus === "succeeded"
    ) {
      const nextVersion = lesson.version + 1;
      const result = await this.lessons.createLessonAndJob(
        userId,
        lesson.sourceTextId,
        nextVersion,
        "analysis"
      );

      await this.lessons.recordMilestone({
        lessonId: result.lesson.id,
        generationJobId: result.job.id,
        code: "queued",
        stage: null,
      });

      return {
        ok: true,
        lessonId: result.lesson.id,
        sourceTextId: lesson.sourceTextId,
      };
    }

    // 2. If analysis failed or exercises failed, retry the failed stage on the SAME lesson record
    const stage =
      lesson.analysisStatus === "failed"
        ? "analysis"
        : lesson.exerciseStatus === "failed"
          ? "exercises"
          : null;
    if (!stage) {
      return {
        ok: false,
        error: "INVALID_STATE",
        message: "Lesson does not have a failed generation stage.",
      };
    }

    const job = await this.lessons.createJob(
      userId,
      lesson.sourceTextId,
      lesson.id,
      stage
    );

    await this.lessons.recordMilestone({
      lessonId: lesson.id,
      generationJobId: job.id,
      code: "queued",
      stage: null,
    });

    return {
      ok: true,
      lessonId: lesson.id,
      sourceTextId: lesson.sourceTextId,
    };
  }

  async processNext(workerId: string): Promise<JobProcessResult> {
    const job = await this.lessons.claimJob(workerId);
    if (!job) {
      return { status: "idle" };
    }
    return this.jobExecutor.execute(job, workerId);
  }

  async getProgress(
    lessonId: string,
    userId: string
  ): Promise<GenerationProgress | null> {
    const progress = await this.lessons.getLessonProgress({
      lessonId,
      userId,
    });
    if (!progress) {
      return null;
    }

    const latestMilestone =
      progress.milestones[progress.milestones.length - 1]?.code ?? null;
    const thoughts = progress.thoughts.map((t) => ({
      stage: t.stage as "analysis" | "exercises",
      text: t.text,
      createdAt: t.createdAt,
    }));

    return {
      lessonId,
      analysisStatus: progress.lesson.analysisStatus,
      exerciseStatus: progress.lesson.exerciseStatus,
      latestMilestone,
      thoughts,
    };
  }
}
