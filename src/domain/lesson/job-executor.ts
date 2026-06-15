import type { TextProcessor } from "@/domain/text";
import {
  getPlainTextFromJSON,
  getHighlightsFromJSON,
} from "@/domain/text/processor";
import { sanitizeGenerationThought } from "@/domain/generation-progress";
import { assertCompleteExercises } from "./rules";
import type {
  LessonRepository,
  GenerationEngine,
  JobProcessResult,
  GenerationJob,
  SaveExercisesInput,
} from "./ports";
import { getLogger, parseDbDate } from "@/lib/logger";

const log = getLogger("d.l.engine.JobExecutor");

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

export type JobExecutionResult = JobProcessResult;

export interface JobExecutor {
  execute(job: GenerationJob, workerId: string): Promise<JobExecutionResult>;
}

export class DefaultJobExecutor implements JobExecutor {
  constructor(
    private lessons: LessonRepository,
    private genEngine: GenerationEngine,
    private textProcessor: TextProcessor
  ) {}

  async execute(
    job: GenerationJob,
    workerId: string
  ): Promise<JobExecutionResult> {
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

    await this.lessons.recordMilestone({
      lessonId: job.lessonId,
      generationJobId: job.id,
      code: "claimed",
      stage: null,
    });

    let currentStage = job.stage as "analysis" | "exercises";

    try {
      const sourceText = await this.lessons.findSourceText(
        job.sourceTextId,
        job.userId
      );
      if (!sourceText) {
        throw new Error("Source text is unavailable.");
      }

      const lesson = await this.lessons.findLesson(job.lessonId, job.userId);
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
        await this.lessons.updateLessonStatus(
          job.lessonId,
          "analysis",
          "running"
        );
        await this.lessons.recordMilestone({
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
              await this.lessons.recordThought({
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

        await this.lessons.recordMilestone({
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

        await this.lessons.updateJobStatus(job.id, "running", {
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
      await this.lessons.updateLessonStatus(
        job.lessonId,
        "exercise",
        "running"
      );
      await this.lessons.recordMilestone({
        lessonId: job.lessonId,
        generationJobId: job.id,
        code: "exercises_started",
        stage: "exercises",
      });

      const analysis = await this.lessons.buildAnalysisFromLesson(job.lessonId);
      let exercises: SaveExercisesInput | null = null;

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const candidate = await this.genEngine.generateExercises(
          analysis,
          async (text) => {
            const sanitized = sanitizeGenerationThought(
              text,
              this.textProcessor
            );
            if (sanitized) {
              await this.lessons.recordThought({
                lessonId: job.lessonId,
                generationJobId: job.id,
                stage: "exercises",
                text: sanitized,
              });
            }
          }
        );

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
        throw new Error(
          "Exercise generation did not return a complete Lesson."
        );
      }

      await this.lessons.saveExercises(
        job.lessonId,
        job.userId,
        exercises,
        process.env.GEMINI_FAST_MODEL ?? "gemini-3.1-flash-lite"
      );

      await this.lessons.recordMilestone({
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

      await this.lessons.updateJobStatus(job.id, "succeeded", {
        errorMessage: null,
      });

      await this.lessons.recordMilestone({
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
        await this.lessons.updateLessonStatus(
          job.lessonId,
          field as any,
          "pending"
        );

        await this.lessons.updateJobStatus(job.id, "queued", {
          stage: currentStage,
          errorMessage: message,
          lockedAt: null,
          lockedBy: null,
        });

        throw error;
      }

      const field = currentStage === "analysis" ? "analysis" : "exercise";
      await this.lessons.updateLessonStatus(
        job.lessonId,
        field as any,
        "failed"
      );

      await this.lessons.updateJobStatus(job.id, "failed", {
        stage: currentStage,
        errorMessage: message,
      });

      await this.lessons.recordMilestone({
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
}
