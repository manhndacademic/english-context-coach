import { getLogger, parseDbDate } from "@/lib/logger";
import {
  getPlainTextFromJSON,
  getHighlightsFromJSON,
} from "@/domain/text/processor";
import { sanitizeGenerationThought } from "@/domain/generation-progress";
import { assertCompleteExercises, prepareAnalysisForSave } from "../rules";
import { isTransientGenerationError, logSpringStyle } from "./helpers";
import type { TextProcessor } from "@/domain/text";
import type {
  JobProcessResult,
  GenerationJob,
  GenerationEngine,
  SourceTextRepository,
  LessonContentRepository,
  GenerationJobRepository,
  GenerationProgressRepository,
  SaveAnalysisInput,
  SaveExercisesInput,
  KeyPhrase,
} from "../ports";

const log = getLogger("d.l.engine.JobRunner");

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

export async function processNext(
  workerId: string,
  deps: {
    sourceTexts: SourceTextRepository;
    lessonContent: LessonContentRepository;
    jobs: GenerationJobRepository;
    progress: GenerationProgressRepository;
    genEngine: GenerationEngine;
    textProcessor: TextProcessor;
    collaborators: LessonEngineCollaborators;
  }
): Promise<JobProcessResult> {
  const job = await deps.jobs.claimJob(workerId);
  if (!job) {
    return { status: "idle" };
  }
  return executeJob(job, workerId, deps);
}

async function executeJob(
  job: GenerationJob,
  workerId: string,
  deps: {
    sourceTexts: SourceTextRepository;
    lessonContent: LessonContentRepository;
    jobs: GenerationJobRepository;
    progress: GenerationProgressRepository;
    genEngine: GenerationEngine;
    textProcessor: TextProcessor;
    collaborators: LessonEngineCollaborators;
  }
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

  await deps.progress.recordMilestone({
    lessonId: job.lessonId,
    generationJobId: job.id,
    code: "claimed",
    stage: null,
  });

  const currentStage = job.stage as "analysis" | "exercises";

  try {
    const sourceText = await deps.sourceTexts.findSourceText(
      job.sourceTextId,
      job.userId
    );
    if (!sourceText) {
      throw new Error("Source text is unavailable.");
    }

    const lesson = await deps.lessonContent.findLesson(
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
      await deps.lessonContent.updateLessonStatus(
        job.lessonId,
        "analysis",
        "running"
      );
      await deps.progress.recordMilestone({
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

      const aggregate = await deps.lessonContent.getLessonAggregate(
        job.lessonId,
        job.userId
      );
      const draftText = aggregate?.draftText;

      let preparedAnalysis: SaveAnalysisInput;

      if (
        lesson.inputMode === "diff" &&
        draftText &&
        deps.genEngine.generateDiffAnalysis
      ) {
        logSpringStyle(
          "INFO",
          workerId,
          `Running diff analysis for Lesson ${job.lessonId}...`
        );
        preparedAnalysis = await deps.genEngine.generateDiffAnalysis(
          draftText.content,
          plainText,
          async (text) => {
            const sanitized = sanitizeGenerationThought(
              text,
              deps.textProcessor
            );
            if (sanitized) {
              await deps.progress.recordThought({
                lessonId: job.lessonId,
                generationJobId: job.id,
                stage: "analysis",
                text: sanitized,
              });
            }
          },
          job.userId,
          job.lessonId
        );
      } else {
        const result = await deps.genEngine.generateAnalysis(
          plainText,
          async (text) => {
            const sanitized = sanitizeGenerationThought(
              text,
              deps.textProcessor
            );
            if (sanitized) {
              await deps.progress.recordThought({
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

        preparedAnalysis = prepareAnalysisForSave(
          result,
          plainText,
          deps.textProcessor
        );
      }

      await deps.lessonContent.saveAnalysis(
        job.lessonId,
        job.userId,
        preparedAnalysis,
        process.env.GEMINI_ANALYSIS_MODEL ?? "gemini-3.1-flash-lite"
      );

      try {
        const savedPhrases = await deps.lessonContent.findKeyPhrases(
          job.lessonId
        );
        if (savedPhrases.length > 0) {
          await deps.collaborators.bulkCreateSrsCardsFromKeyPhrases(
            job.userId,
            savedPhrases
          );
        }
      } catch (queueErr) {
        log.warn(
          `[LessonEngine] Failed to enqueue phrase SRS cards for lesson ${job.lessonId}: ${queueErr}`
        );
      }

      await deps.progress.recordMilestone({
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

      await deps.jobs.updateJobStatus(job.id, "succeeded", {
        errorMessage: null,
      });

      await deps.progress.recordMilestone({
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
        `Job ${job.id} (Stage: analysis) completed successfully. Active processing: ${totalProcessingTime}ms (Total lifetime: ${totalJobLifetime}ms).`
      );

      return {
        status: "processed",
        jobId: job.id,
        lessonId: job.lessonId,
        success: true,
      };
    }

    logSpringStyle(
      "INFO",
      workerId,
      `Starting stage "exercises" for Lesson ${job.lessonId}...`
    );
    const exercisesStart = Date.now();
    await Promise.all([
      deps.lessonContent.updateLessonStatus(
        job.lessonId,
        "exercise",
        "running"
      ),
      deps.progress.recordMilestone({
        lessonId: job.lessonId,
        generationJobId: job.id,
        code: "exercises_started",
        stage: "exercises",
      }),
    ]);

    const analysis = await deps.lessonContent.buildAnalysisFromLesson(
      job.lessonId
    );
    let exercises: SaveExercisesInput | null = null;
    const activePatterns = deps.collaborators.getActiveMistakePatterns
      ? await deps.collaborators.getActiveMistakePatterns(job.userId)
      : [];

    const runExerciseGeneration = async (
      attempt: number
    ): Promise<SaveExercisesInput> => {
      const candidate = await deps.genEngine.generateExercises(
        analysis,
        async (text) => {
          const sanitized = sanitizeGenerationThought(text, deps.textProcessor);
          if (sanitized) {
            await deps.progress.recordThought({
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
        assertCompleteExercises(candidate, analysis, deps.textProcessor);
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
      throw new Error("Exercise generation did not return a complete Lesson.");
    }

    await deps.lessonContent.saveExercises(
      job.lessonId,
      job.userId,
      exercises,
      process.env.GEMINI_FAST_MODEL ?? "gemini-3.1-flash-lite"
    );

    await deps.progress.recordMilestone({
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

    await deps.jobs.updateJobStatus(job.id, "succeeded", {
      errorMessage: null,
    });

    await deps.progress.recordMilestone({
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
        deps.lessonContent.updateLessonStatus(
          job.lessonId,
          field as any,
          "pending"
        ),
        deps.jobs.updateJobStatus(job.id, "queued", {
          stage: currentStage,
          errorMessage: message,
          lockedAt: null,
          lockedBy: null,
        }),
        deps.collaborators.notifyJobQueued(),
      ]);

      throw error;
    }

    const field = currentStage === "analysis" ? "analysis" : "exercise";
    await Promise.all([
      deps.lessonContent.updateLessonStatus(
        job.lessonId,
        field as any,
        "failed"
      ),
      deps.jobs.updateJobStatus(job.id, "failed", {
        stage: currentStage,
        errorMessage: message,
      }),
      deps.progress.recordMilestone({
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
