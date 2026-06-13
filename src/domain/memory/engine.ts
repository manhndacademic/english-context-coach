import type { TextProcessor } from "@/domain/text";
import { getLogger, parseDbDate } from "@/lib/logger";

const log = getLogger("d.m.engine.LearnerMemoryEngine");
import { nextDueDate, nextReviewAfterSuccess, resetDueAfterFailure } from "@/domain/review";
import { masteryStateAfterReview } from "./mastery";
import type { LessonRepository } from "@/domain/lesson/ports";
import type { LearnerMemoryRepository, GradingEngine, JobDispatcher, ReviewPromptGenerator } from "./ports";
import type {
  LearnerMemoryEngine as LearnerMemoryEngineInterface,
  SubmitAttemptInput,
  AttemptFormResult,
  SubmitReviewAttemptInput,
  ReviewFormResult,
} from "./types";

function categoryForLessonFocus(category: "tone" | "structure" | "purpose" | "context") {
  if (category === "structure") return "grammar_pattern" as const;
  if (category === "tone") return "business_phrase" as const;
  return "general_phrase" as const;
}

export class DefaultLearnerMemoryEngine implements LearnerMemoryEngineInterface {
  constructor(
    private repo: LearnerMemoryRepository,
    private lessonRepo: LessonRepository,
    private grader: GradingEngine,
    private dispatcher: JobDispatcher,
    private reviewGenerator: ReviewPromptGenerator,
    private textProcessor: TextProcessor
  ) {}

  async submitAttempt(input: SubmitAttemptInput): Promise<AttemptFormResult> {
    try {
      const exercise = await this.repo.findExercise(input.exerciseId, input.userId);
      if (!exercise) {
        return {
          success: false,
          isCorrect: false,
          score: 0,
          feedbackVi: "Bài tập không tồn tại hoặc không thuộc về người dùng này.",
          userErrorCreated: false,
          mistakePatternStatus: "none",
          error: "Exercise not found.",
        };
      }

      const grade = await this.grader.grade({
        userId: input.userId,
        lessonId: input.lessonId,
        exercise,
        answer: input.answer,
      });

      const saveError =
        !grade.isCorrect &&
        grade.error &&
        grade.error.shouldSave &&
        grade.error.confidence >= 70;

      let keyPhrase = null;
      let lessonFocus = null;

      let targetItem = "";
      let normalizedPhrase = "";
      let senseKey = "";
      let category: "idiom" | "phrasal_verb" | "technical_term" | "collocation" | "grammar_pattern" | "business_phrase" | "general_phrase" = "general_phrase";
      let meaningVi = "";
      let explanationVi = "";
      let conceptKey = "";
      let conceptPhrase = "";
      let conceptMeaningVi = "";

      if (saveError) {
        const errorData = grade.error!;

        if (exercise.keyPhraseId) {
          keyPhrase = await this.lessonRepo.findKeyPhrase(exercise.keyPhraseId);
        }
        if (exercise.lessonFocusId) {
          lessonFocus = await this.lessonRepo.findLessonFocus(exercise.lessonFocusId);
        }

        const fallbackTarget = exercise.correctAnswer ?? exercise.promptEn ?? exercise.promptVi;
        targetItem = errorData.targetItem || fallbackTarget;

        normalizedPhrase = keyPhrase?.normalizedPhrase ?? this.textProcessor.normalizePhrase(lessonFocus?.title ?? targetItem);
        senseKey = keyPhrase?.senseKey ?? this.textProcessor.normalizePhrase(`${lessonFocus?.category ?? "exercise"}:${lessonFocus?.title ?? targetItem}`);
        category = keyPhrase?.category ?? (lessonFocus ? categoryForLessonFocus(lessonFocus.category) : "general_phrase");
        meaningVi = keyPhrase?.meaningVi ?? lessonFocus?.explanationVi ?? errorData.explanationVi ?? "Ôn lại nghĩa tự nhiên trong ngữ cảnh.";
        explanationVi = errorData.explanationVi ?? grade.feedbackVi;

        conceptKey = keyPhrase?.conceptKey ?? lessonFocus?.conceptKey ?? this.textProcessor.normalizePhrase(targetItem);
        conceptPhrase = keyPhrase?.conceptPhrase ?? lessonFocus?.conceptPhrase ?? normalizedPhrase;
        conceptMeaningVi = keyPhrase?.conceptMeaningVi ?? lessonFocus?.conceptMeaningVi ?? meaningVi;
      }

      let isRepeated = false;
      let insertedPattern: any = null;

      // 2. Perform persistence within transaction context
      await this.repo.runInTransaction(async (tx) => {
        const attempt = await tx.createAttempt({
          exerciseId: input.exerciseId,
          lessonId: input.lessonId,
          userId: input.userId,
          answer: input.answer,
          score: grade.score,
          isCorrect: grade.isCorrect,
          feedbackVi: grade.feedbackVi,
          gradingMetadata: grade,
        });

        if (saveError) {
          const errorData = grade.error!;
          const existingPattern = await tx.findPatternByConcept(
            input.userId,
            conceptKey,
            errorData.errorType as any
          );

          isRepeated = !!existingPattern;

          await tx.createUserError({
            userId: input.userId,
            attemptId: attempt.id,
            lessonId: input.lessonId,
            keyPhraseId: keyPhrase?.id ?? null,
            lessonFocusId: lessonFocus?.id ?? null,
            errorType: errorData.errorType!,
            conceptKey,
            normalizedPhrase: conceptPhrase,
            senseKey,
            explanationVi,
            isSourceSensitive: keyPhrase?.isSensitive ?? false,
            isRepeated,
          });

          insertedPattern = await tx.upsertMistakePattern({
            userId: input.userId,
            conceptKey,
            normalizedPhrase: conceptPhrase,
            senseKey: keyPhrase?.senseKey ?? null,
            category,
            errorType: errorData.errorType as any,
            meaningVi: conceptMeaningVi,
            safeReviewPromptVi: `Ôn lại cụm "${conceptPhrase}" theo nghĩa tự nhiên trong ngữ cảnh.`,
            isSensitive: keyPhrase?.isSensitive ?? false,
          });
        }
      });

      // 3. Dispatch background prompt generation outside transaction
      if (insertedPattern && (!isRepeated || !insertedPattern.reviewPromptEn)) {
        this.dispatcher.triggerReviewPromptGeneration(insertedPattern.id).catch((err) =>
          console.error(`[Engine] Failed to trigger review prompt generation: ${err}`)
        );
      }

      return {
        success: true,
        isCorrect: grade.isCorrect,
        score: grade.score,
        feedbackVi: grade.feedbackVi,
        userErrorCreated: !!saveError,
        mistakePatternStatus: saveError ? (isRepeated ? "repeated" : "new") : "none",
      };
    } catch (error) {
      console.error("[LearnerMemoryEngine] Error in submitAttempt:", error);
      return {
        success: false,
        isCorrect: false,
        score: 0,
        feedbackVi: "Đã xảy ra lỗi hệ thống khi xử lý câu trả lời của bạn.",
        userErrorCreated: false,
        mistakePatternStatus: "none",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async submitReviewAttempt(input: SubmitReviewAttemptInput): Promise<ReviewFormResult> {
    try {
      const pattern = await this.repo.findMistakePattern(input.patternId, input.userId);
      if (!pattern) {
        return {
          success: false,
          isCorrect: false,
          score: 0,
          feedbackVi: "Lỗi ôn tập không tồn tại hoặc không thuộc về người dùng này.",
          masteryStateUpdated: false,
          error: "Mistake pattern not found.",
        };
      }

      const promptEn = pattern.reviewPromptEn ?? pattern.normalizedPhrase;
      const promptVi = pattern.reviewPromptVi ?? `Dịch cụm từ hoặc câu sau sang nghĩa tự nhiên: "${pattern.normalizedPhrase}"`;
      const correctAnswer = pattern.reviewCorrectAnswer ?? pattern.meaningVi;
      const acceptableAnswers = pattern.reviewAcceptableAnswers ?? [];
      const rubricVi = pattern.reviewRubricVi ?? `Đảm bảo người học hiểu đúng nghĩa tự nhiên của cụm từ "${pattern.normalizedPhrase}" là "${pattern.meaningVi}". Tránh dịch nghĩa đen.`;

      const mockExercise = {
        id: pattern.id,
        lessonId: "review",
        userId: input.userId,
        type: "natural_translation" as const,
        promptVi,
        promptEn,
        choices: null,
        correctAnswer,
        acceptableAnswers,
        rubricVi,
        keyPhraseId: null,
        lessonFocusId: null,
        orderIndex: 0,
        createdAt: new Date(),
      };

      // 1. Grade the attempt (AI call outside transaction)
      const grade = await this.grader.grade({
        userId: input.userId,
        lessonId: undefined,
        exercise: mockExercise,
        answer: input.answer,
      });

      const intervalDays = grade.isCorrect
        ? nextReviewAfterSuccess(pattern.intervalDays)
        : 0;

      const dueAt = grade.isCorrect
        ? nextDueDate(intervalDays)
        : resetDueAfterFailure();
      const masteryState = masteryStateAfterReview(grade.isCorrect, intervalDays);

      // 2. Perform persistence within transaction context
      await this.repo.runInTransaction(async (tx) => {
        await tx.createReviewAttempt({
          userId: input.userId,
          mistakePatternId: pattern.id,
          answer: input.answer,
          score: grade.score,
          isCorrect: grade.isCorrect,
          feedbackVi: grade.feedbackVi,
        });

        await tx.updateMistakePatternSchedule(pattern.id, {
          intervalDays,
          dueAt,
          lastReviewedAt: new Date(),
          masteryState,
        });
      });

      // 3. Trigger review prompt regeneration on success (outside transaction)
      if (grade.isCorrect) {
        this.dispatcher.triggerReviewPromptGeneration(pattern.id).catch((err) =>
          console.error(`[Engine] Failed to trigger review prompt generation on success: ${err}`)
        );
      }

      return {
        success: true,
        isCorrect: grade.isCorrect,
        score: grade.score,
        feedbackVi: grade.feedbackVi,
        masteryStateUpdated: true,
        masteryState,
        nextReviewAt: dueAt,
        naturalAnswer: grade.naturalAnswer ?? correctAnswer,
      };
    } catch (error) {
      console.error("[LearnerMemoryEngine] Error in submitReviewAttempt:", error);
      return {
        success: false,
        isCorrect: false,
        score: 0,
        feedbackVi: "Đã xảy ra lỗi hệ thống khi xử lý câu ôn tập của bạn.",
        masteryStateUpdated: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async generateReviewPrompt(patternId: string): Promise<void> {
    try {
      const pattern = await this.repo.findMistakePatternById(patternId);
      if (!pattern) return;

      log.info(`Generating review prompt directly for pattern ${patternId}...`);
      const startTime = Date.now();
      const generated = await this.reviewGenerator.generate({
        userId: pattern.userId,
        conceptPhrase: pattern.normalizedPhrase,
        conceptMeaningVi: pattern.meaningVi,
        category: pattern.category,
        errorType: pattern.errorType,
      });

      await this.repo.updateMistakePatternReviewPrompt(patternId, generated);
      log.info(`Review prompt generated directly for pattern ${patternId} in ${Date.now() - startTime}ms.`);
    } catch (error) {
      log.error(`generateReviewPrompt failed for pattern ${patternId}`, error);
    }
  }

  async processNextReviewPromptJob(
    workerId: string
  ): Promise<
    | { status: "processed"; patternId: string; success: boolean }
    | { status: "idle" }
    | { status: "failed"; error: string }
  > {
    try {
      const pattern = await this.repo.claimReviewPromptJob(workerId);
      if (!pattern) {
        return { status: "idle" };
      }

      const parsedLockedVal = parseDbDate(pattern.reviewPromptLockedAt);
      const queueLatency = parsedLockedVal 
        ? Date.now() - parsedLockedVal.getTime() 
        : 0;
      log.info(`Claimed review prompt job ${pattern.id} for pattern. Queue latency: ${queueLatency}ms.`, workerId);
      const startTime = Date.now();

      try {
        const generated = await this.reviewGenerator.generate({
          userId: pattern.userId,
          conceptPhrase: pattern.normalizedPhrase,
          conceptMeaningVi: pattern.meaningVi,
          category: pattern.category,
          errorType: pattern.errorType,
        });

        await this.repo.updateReviewPromptJobStatus(pattern.id, "succeeded", {
          ...generated,
          reviewPromptError: null,
          reviewPromptLockedAt: null,
          reviewPromptLockedBy: null,
        });

        log.info(`Review prompt job ${pattern.id} succeeded in ${Date.now() - startTime}ms.`, workerId);

        return {
          status: "processed",
          patternId: pattern.id,
          success: true,
        };
      } catch (genError) {
        const message = genError instanceof Error ? genError.message : String(genError);
        const attempts = pattern.reviewPromptAttempts ?? 0;

        log.warn(`Review prompt job ${pattern.id} failed (attempt ${attempts}): ${message}`, workerId);

        if (attempts < 3) {
          await this.repo.updateReviewPromptJobStatus(pattern.id, "queued", {
            reviewPromptError: message,
            reviewPromptLockedAt: null,
            reviewPromptLockedBy: null,
          });
        } else {
          await this.repo.updateReviewPromptJobStatus(pattern.id, "failed", {
            reviewPromptError: message,
            reviewPromptLockedAt: null,
            reviewPromptLockedBy: null,
          });
        }

        return {
          status: "processed",
          patternId: pattern.id,
          success: false,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`processNextReviewPromptJob failed`, error, workerId);
      return {
        status: "failed",
        error: message,
      };
    }
  }
}
