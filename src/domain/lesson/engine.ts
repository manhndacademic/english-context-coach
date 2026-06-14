import { SOURCE_TEXT_MAX_LENGTH } from "@/domain/constants";
import type { TextProcessor } from "@/domain/text";
import { getPlainTextFromJSON, getHighlightsFromJSON } from "@/domain/text/processor";
import { sanitizeGenerationThought } from "@/domain/generation-progress";
import { assertCompleteExercises } from "./rules";
import type {
  LessonGenerationEngine as LessonGenerationEngineInterface,
  SourceTextRepository,
  LessonRepository,
  GenerationJobRepository,
  GenerationProgressRepository,
  LessonTransactionCoordinator,
  GenerationEngine,
  LessonGenerationResult,
  JobProcessResult,
  GenerationProgress,
  SaveExercisesInput,
} from "./ports";


import { getLogger, parseDbDate } from "@/lib/logger";

const log = getLogger("d.l.engine.LessonGenerationEngine");

function isTransientGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ECONNRESET") ||
    message.includes("socket connection was closed") ||
    message.includes("\"code\":429") ||
    message.includes("Too Many Requests") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("\"code\":503") ||
    message.includes("UNAVAILABLE") ||
    message.includes("high demand")
  );
}

function logSpringStyle(level: "INFO" | "WARN" | "ERROR", workerId: string, message: string) {
  if (level === "ERROR") {
    log.error(message, undefined, workerId);
  } else if (level === "WARN") {
    log.warn(message, workerId);
  } else {
    log.info(message, workerId);
  }
}

export class DefaultLessonGenerationEngine implements LessonGenerationEngineInterface {
  constructor(
    private sourceTexts: SourceTextRepository,
    private lessons: LessonRepository,
    private generationJobs: GenerationJobRepository,
    private generationProgress: GenerationProgressRepository,
    private txCoordinator: LessonTransactionCoordinator,
    private genEngine: GenerationEngine,
    private textProcessor: TextProcessor
  ) {}

  async queue(userId: string, content: string, requestedMode?: string): Promise<LessonGenerationResult> {
    const { normalized, hash: contentHash } = this.textProcessor.processSource(content);
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

    const capacityError = await this.generationJobs.assertQueueCapacity(userId);
    if (capacityError) {
      return {
        ok: false,
        error: "CAPACITY_EXCEEDED",
        message: capacityError,
      };
    }

    const result = await this.txCoordinator.createSourceTextAndLessonAndJob(
      userId,
      normalized,
      "Untitled source",
      contentHash,
      requestedMode
    );

    await this.generationProgress.recordMilestone({
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

  async retry(userId: string, lessonId: string): Promise<LessonGenerationResult> {
    const lesson = await this.lessons.findLesson(lessonId, userId);
    if (!lesson) {
      return {
        ok: false,
        error: "NOT_FOUND",
        message: "Lesson not found.",
      };
    }

    if (lesson.analysisStatus === "running" || lesson.exerciseStatus === "running") {
      return {
        ok: false,
        error: "INVALID_STATE",
        message: "Lesson is already generating.",
      };
    }

    const capacityError = await this.generationJobs.assertQueueCapacity(userId);
    if (capacityError) {
      return {
        ok: false,
        error: "CAPACITY_EXCEEDED",
        message: capacityError,
      };
    }

    // 1. If both are succeeded, it's a regeneration (create a new version)
    if (lesson.analysisStatus === "succeeded" && lesson.exerciseStatus === "succeeded") {
      const nextVersion = lesson.version + 1;
      const result = await this.txCoordinator.createLessonAndJob(
        userId,
        lesson.sourceTextId,
        nextVersion,
        "analysis"
      );

      await this.generationProgress.recordMilestone({
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
    const stage = lesson.analysisStatus === "failed" ? "analysis" : lesson.exerciseStatus === "failed" ? "exercises" : null;
    if (!stage) {
      return {
        ok: false,
        error: "INVALID_STATE",
        message: "Lesson does not have a failed generation stage.",
      };
    }

    const job = await this.txCoordinator.createJob(userId, lesson.sourceTextId, lesson.id, stage);

    await this.generationProgress.recordMilestone({
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
    const job = await this.generationJobs.claimJob(workerId);
    if (!job) {
      return { status: "idle" };
    }

    const jobClaimTime = Date.now();
    const parsedCreatedVal = parseDbDate(job.createdAt);
    const queueLatency = parsedCreatedVal ? (jobClaimTime - parsedCreatedVal.getTime()) : 0;
    logSpringStyle("INFO", workerId, `Claimed job ${job.id} for Lesson ${job.lessonId} (Stage: ${job.stage}). Time in queue: ${queueLatency}ms.`);

    await this.generationProgress.recordMilestone({
      lessonId: job.lessonId,
      generationJobId: job.id,
      code: "claimed",
      stage: null,
    });

    let currentStage = job.stage as "analysis" | "exercises";

    try {
      const sourceText = await this.sourceTexts.findSourceText(job.sourceTextId, job.userId);
      if (!sourceText) {
        throw new Error("Source text is unavailable.");
      }

      const lesson = await this.lessons.findLesson(job.lessonId, job.userId);
      if (!lesson) {
        throw new Error("Lesson is unavailable.");
      }

      if (currentStage === "analysis") {
        logSpringStyle("INFO", workerId, `Starting stage "analysis" for Lesson ${job.lessonId}...`);
        const analysisStart = Date.now();
        await this.lessons.updateLessonStatus(job.lessonId, "analysis", "running");
        await this.generationProgress.recordMilestone({
          lessonId: job.lessonId,
          generationJobId: job.id,
          code: "analysis_started",
          stage: "analysis",
        });

        let plainText = sourceText.content;
        let userHighlights: string[] = [];
        try {
          const parsed = JSON.parse(sourceText.content);
          if (parsed && typeof parsed === "object" && parsed.type === "doc") {
            plainText = getPlainTextFromJSON(parsed);
            userHighlights = getHighlightsFromJSON(parsed);
          }
        } catch {
          // Ignore JSON parse error, treat content as plain text
        }

        const result = await this.genEngine.generateAnalysis(
          plainText,
          async (text) => {
            const sanitized = sanitizeGenerationThought(text, this.textProcessor);
            if (sanitized) {
              await this.generationProgress.recordThought({
                lessonId: job.lessonId,
                generationJobId: job.id,
                stage: "analysis",
                text: sanitized,
              });
            }
          },
          lesson.inputMode,
          userHighlights
        );

        await this.lessons.saveAnalysis(
          job.lessonId,
          job.userId,
          result,
          process.env.GEMINI_ANALYSIS_MODEL ?? "gemini-3.1-flash-lite"
        );

        await this.generationProgress.recordMilestone({
          lessonId: job.lessonId,
          generationJobId: job.id,
          code: "analysis_saved",
          stage: "analysis",
        });

        const analysisDuration = Date.now() - analysisStart;
        logSpringStyle("INFO", workerId, `Stage "analysis" succeeded in ${analysisDuration}ms.`);

        await this.generationJobs.updateJobStatus(job.id, "running", { stage: "exercises" });
        currentStage = "exercises";
      }

      logSpringStyle("INFO", workerId, `Starting stage "exercises" for Lesson ${job.lessonId}...`);
      const exercisesStart = Date.now();
      await this.lessons.updateLessonStatus(job.lessonId, "exercise", "running");
      await this.generationProgress.recordMilestone({
        lessonId: job.lessonId,
        generationJobId: job.id,
        code: "exercises_started",
        stage: "exercises",
      });

      const analysis = await this.lessons.buildAnalysisFromLesson(job.lessonId);
      let exercises: SaveExercisesInput | null = null;

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const candidate = await this.genEngine.generateExercises(analysis, async (text) => {
          const sanitized = sanitizeGenerationThought(text, this.textProcessor);
          if (sanitized) {
            await this.generationProgress.recordThought({
              lessonId: job.lessonId,
              generationJobId: job.id,
              stage: "exercises",
              text: sanitized,
            });
          }
        });

        try {
          assertCompleteExercises(candidate, analysis, this.textProcessor);
          exercises = candidate;
          break;
        } catch (error) {
          if (attempt === 2) {
            throw error;
          }
        }
      }

      if (!exercises) {
        throw new Error("Exercise generation did not return a complete Lesson.");
      }

      await this.lessons.saveExercises(
        job.lessonId,
        job.userId,
        exercises,
        process.env.GEMINI_FAST_MODEL ?? "gemini-3.1-flash-lite"
      );

      await this.generationProgress.recordMilestone({
        lessonId: job.lessonId,
        generationJobId: job.id,
        code: "exercises_saved",
        stage: "exercises",
      });

      const exercisesDuration = Date.now() - exercisesStart;
      logSpringStyle("INFO", workerId, `Stage "exercises" succeeded in ${exercisesDuration}ms.`);

      await this.generationJobs.updateJobStatus(job.id, "succeeded", { errorMessage: null });

      await this.generationProgress.recordMilestone({
        lessonId: job.lessonId,
        generationJobId: job.id,
        code: "completed",
        stage: null,
      });

      const totalProcessingTime = Date.now() - jobClaimTime;
      const parsedCreatedVal2 = parseDbDate(job.createdAt);
      const totalJobLifetime = parsedCreatedVal2 ? (Date.now() - parsedCreatedVal2.getTime()) : 0;
      logSpringStyle("INFO", workerId, `Job ${job.id} completed successfully. Active processing: ${totalProcessingTime}ms (Total lifetime: ${totalJobLifetime}ms).`);

      return {
        status: "processed",
        jobId: job.id,
        lessonId: job.lessonId,
        success: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown generation error";
      logSpringStyle("ERROR", workerId, `Job ${job.id} failed with error: ${message}`);
      const transient = isTransientGenerationError(error);

      if (transient && job.attempts < 3) {
        const field = currentStage === "analysis" ? "analysis" : "exercise";
        await this.lessons.updateLessonStatus(job.lessonId, field as any, "pending");

        await this.generationJobs.updateJobStatus(job.id, "queued", {
          stage: currentStage,
          errorMessage: message,
          lockedAt: null,
          lockedBy: null,
        });

        throw error;
      }

      const field = currentStage === "analysis" ? "analysis" : "exercise";
      await this.lessons.updateLessonStatus(job.lessonId, field as any, "failed");

      await this.generationJobs.updateJobStatus(job.id, "failed", {
        stage: currentStage,
        errorMessage: message,
      });

      await this.generationProgress.recordMilestone({
        lessonId: job.lessonId,
        generationJobId: job.id,
        code: "failed",
        stage: currentStage,
      });

      return {
        status: "processed",
        jobId: job.id,
        lessonId: job.lessonId,
        success: false,
      };
    }
  }

  async getProgress(lessonId: string, userId: string): Promise<GenerationProgress | null> {
    const progress = await this.generationProgress.getLessonProgress({ lessonId, userId });
    if (!progress) {
      return null;
    }

    const latestMilestone = progress.milestones[progress.milestones.length - 1]?.code ?? null;
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
