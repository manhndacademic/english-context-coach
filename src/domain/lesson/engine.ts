import { SOURCE_TEXT_MAX_LENGTH } from "@/domain/constants";
import type { TextProcessor } from "@/domain/text";
import { notifyJobQueued } from "@/lib/jobs/trigger";
import {
  getPlainTextFromJSON,
  getHighlightsFromJSON,
} from "@/domain/text/processor";
import { sanitizeGenerationThought } from "@/domain/generation-progress";
import { assertCompleteExercises, prepareAnalysisForSave } from "./rules";
import { getLogger, parseDbDate } from "@/lib/logger";
import type {
  LessonGenerationEngine as LessonGenerationEngineInterface,
  GenerationEngine,
  LessonGenerationResult,
  JobProcessResult,
  GenerationProgress,
  GenerationJob,
  SaveExercisesInput,
  SourceTextRepository,
  LessonContentRepository,
  GenerationJobRepository,
  GenerationProgressRepository,
  LessonTransactionRepository,
  KeyPhrase,
} from "./ports";

const log = getLogger("d.l.engine.LessonGenerationEngine");

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

function isTransientGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ECONNRESET") ||
    message.includes("socket connection was closed") ||
    message.includes('"code":429') ||
    message.includes("Too Many Requests") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes('"code":503') ||
    message.includes("UNAVAILABLE") ||
    message.includes("high demand")
  );
}

function logSpringStyle(
  level: "INFO" | "WARN" | "ERROR",
  workerId: string,
  message: string
) {
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

    const capacityError = await this.jobs.assertQueueCapacity(userId);
    if (capacityError) {
      return {
        ok: false,
        error: "CAPACITY_EXCEEDED",
        message: capacityError,
      };
    }

    const result = await this.tx.createSourceTextAndLessonAndJob(
      userId,
      content,
      "Untitled source",
      contentHash,
      requestedMode
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

  async retry(
    userId: string,
    lessonId: string
  ): Promise<LessonGenerationResult> {
    const lesson = await this.lessonContent.findLesson(lessonId, userId);
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

    const capacityError = await this.jobs.assertQueueCapacity(userId);
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
      const result = await this.tx.createLessonAndJob(
        userId,
        lesson.sourceTextId,
        nextVersion,
        "analysis"
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

    const job = await this.tx.createJob(
      userId,
      lesson.sourceTextId,
      lesson.id,
      stage
    );

    await Promise.all([
      this.progress.recordMilestone({
        lessonId: lesson.id,
        generationJobId: job.id,
        code: "queued",
        stage: null,
      }),
      this.collaborators.notifyJobQueued(),
    ]);

    return {
      ok: true,
      lessonId: lesson.id,
      sourceTextId: lesson.sourceTextId,
    };
  }

  async deleteSourceText(userId: string, sourceTextId: string): Promise<void> {
    await this.sourceTexts.deleteSourceText(userId, sourceTextId);
    await this.collaborators.scrubSensitiveContentForSourceText(
      userId,
      sourceTextId
    );
  }

  async processNext(workerId: string): Promise<JobProcessResult> {
    const job = await this.jobs.claimJob(workerId);
    if (!job) {
      return { status: "idle" };
    }
    return this.executeJob(job, workerId);
  }

  private async executeJob(
    job: GenerationJob,
    workerId: string
  ): Promise<JobProcessResult> {
    const jobClaimTime = Date.now();
    const parsedCreatedVal = parseDbDate(job.createdAt);
    const queueLatency = parsedCreatedVal
      ? jobClaimTime - parsedCreatedVal.getTime()
      : 0;

    logSpringStyle(
      "INFO",
      workerId,
      `Claimed job ${job.id} for Lesson ${job.lessonId} (Stage: ${job.stage}). Time in queue: ${queueLatency}ms.`
    );

    await this.progress.recordMilestone({
      lessonId: job.lessonId,
      generationJobId: job.id,
      code: "claimed",
      stage: null,
    });

    let currentStage = job.stage as "analysis" | "exercises";

    try {
      const sourceText = await this.sourceTexts.findSourceText(
        job.sourceTextId,
        job.userId
      );
      if (!sourceText) {
        throw new Error("Source text is unavailable.");
      }

      const lesson = await this.lessonContent.findLesson(
        job.lessonId,
        job.userId
      );
      if (!lesson) {
        throw new Error("Lesson is unavailable.");
      }

      if (currentStage === "analysis") {
        logSpringStyle(
          "INFO",
          workerId,
          `Starting stage "analysis" for Lesson ${job.lessonId}...`
        );
        const analysisStart = Date.now();
        await this.lessonContent.updateLessonStatus(
          job.lessonId,
          "analysis",
          "running"
        );
        await this.progress.recordMilestone({
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
            const sanitized = sanitizeGenerationThought(
              text,
              this.textProcessor
            );
            if (sanitized) {
              await this.progress.recordThought({
                lessonId: job.lessonId,
                generationJobId: job.id,
                stage: "analysis",
                text: sanitized,
              });
            }
          },
          lesson.inputMode,
          userHighlights,
          job.userId,
          job.lessonId
        );

        const preparedAnalysis = prepareAnalysisForSave(
          result,
          plainText,
          this.textProcessor
        );

        await this.lessonContent.saveAnalysis(
          job.lessonId,
          job.userId,
          preparedAnalysis,
          process.env.GEMINI_ANALYSIS_MODEL ?? "gemini-3.1-flash-lite"
        );

        try {
          const savedPhrases = await this.lessonContent.findKeyPhrases(
            job.lessonId
          );
          if (savedPhrases.length > 0) {
            await this.collaborators.bulkCreateSrsCardsFromKeyPhrases(
              job.userId,
              savedPhrases
            );
          }
        } catch (queueErr) {
          log.warn(
            `[LessonEngine] Failed to enqueue phrase SRS cards for lesson ${job.lessonId}: ${queueErr}`
          );
        }

        await this.progress.recordMilestone({
          lessonId: job.lessonId,
          generationJobId: job.id,
          code: "analysis_saved",
          stage: "analysis",
        });

        const analysisDuration = Date.now() - analysisStart;
        logSpringStyle(
          "INFO",
          workerId,
          `Stage "analysis" succeeded in ${analysisDuration}ms.`
        );

        await this.jobs.updateJobStatus(job.id, "running", {
          stage: "exercises",
        });
        currentStage = "exercises";
      }

      logSpringStyle(
        "INFO",
        workerId,
        `Starting stage "exercises" for Lesson ${job.lessonId}...`
      );
      const exercisesStart = Date.now();
      await Promise.all([
        this.lessonContent.updateLessonStatus(
          job.lessonId,
          "exercise",
          "running"
        ),
        this.progress.recordMilestone({
          lessonId: job.lessonId,
          generationJobId: job.id,
          code: "exercises_started",
          stage: "exercises",
        }),
      ]);

      const analysis = await this.lessonContent.buildAnalysisFromLesson(
        job.lessonId
      );
      let exercises: SaveExercisesInput | null = null;
      const activePatterns = this.collaborators.getActiveMistakePatterns
        ? await this.collaborators.getActiveMistakePatterns(job.userId)
        : [];

      const runExerciseGeneration = async (
        attempt: number
      ): Promise<SaveExercisesInput> => {
        const candidate = await this.genEngine.generateExercises(
          analysis,
          async (text) => {
            const sanitized = sanitizeGenerationThought(
              text,
              this.textProcessor
            );
            if (sanitized) {
              await this.progress.recordThought({
                lessonId: job.lessonId,
                generationJobId: job.id,
                stage: "exercises",
                text: sanitized,
              });
            }
          },
          job.userId,
          job.lessonId,
          activePatterns
        );

        try {
          assertCompleteExercises(candidate, analysis, this.textProcessor);
          return candidate;
        } catch (error) {
          if (attempt >= 2) {
            throw error;
          }
          return runExerciseGeneration(attempt + 1);
        }
      };

      exercises = await runExerciseGeneration(1);

      if (!exercises) {
        throw new Error(
          "Exercise generation did not return a complete Lesson."
        );
      }

      await this.lessonContent.saveExercises(
        job.lessonId,
        job.userId,
        exercises,
        process.env.GEMINI_FAST_MODEL ?? "gemini-3.1-flash-lite"
      );

      await this.progress.recordMilestone({
        lessonId: job.lessonId,
        generationJobId: job.id,
        code: "exercises_saved",
        stage: "exercises",
      });

      const exercisesDuration = Date.now() - exercisesStart;
      logSpringStyle(
        "INFO",
        workerId,
        `Stage "exercises" succeeded in ${exercisesDuration}ms.`
      );

      await this.jobs.updateJobStatus(job.id, "succeeded", {
        errorMessage: null,
      });

      await this.progress.recordMilestone({
        lessonId: job.lessonId,
        generationJobId: job.id,
        code: "completed",
        stage: null,
      });

      const totalProcessingTime = Date.now() - jobClaimTime;
      const parsedCreatedVal2 = parseDbDate(job.createdAt);
      const totalJobLifetime = parsedCreatedVal2
        ? Date.now() - parsedCreatedVal2.getTime()
        : 0;
      logSpringStyle(
        "INFO",
        workerId,
        `Job ${job.id} completed successfully. Active processing: ${totalProcessingTime}ms (Total lifetime: ${totalJobLifetime}ms).`
      );

      return {
        status: "processed",
        jobId: job.id,
        lessonId: job.lessonId,
        success: true,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown generation error";
      logSpringStyle(
        "ERROR",
        workerId,
        `Job ${job.id} failed with error: ${message}`
      );
      const transient = isTransientGenerationError(error);

      if (transient && job.attempts < 3) {
        const field = currentStage === "analysis" ? "analysis" : "exercise";
        await Promise.all([
          this.lessonContent.updateLessonStatus(
            job.lessonId,
            field as any,
            "pending"
          ),
          this.jobs.updateJobStatus(job.id, "queued", {
            stage: currentStage,
            errorMessage: message,
            lockedAt: null,
            lockedBy: null,
          }),
          this.collaborators.notifyJobQueued(),
        ]);

        throw error;
      }

      const field = currentStage === "analysis" ? "analysis" : "exercise";
      await Promise.all([
        this.lessonContent.updateLessonStatus(
          job.lessonId,
          field as any,
          "failed"
        ),
        this.jobs.updateJobStatus(job.id, "failed", {
          stage: currentStage,
          errorMessage: message,
        }),
        this.progress.recordMilestone({
          lessonId: job.lessonId,
          generationJobId: job.id,
          code: "failed",
          stage: currentStage,
        }),
      ]);

      return {
        status: "processed",
        jobId: job.id,
        lessonId: job.lessonId,
        success: false,
      };
    }
  }

  async getProgress(
    lessonId: string,
    userId: string
  ): Promise<GenerationProgress | null> {
    const progress = await this.progress.getLessonProgress({
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
