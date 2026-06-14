import type { TextProcessor } from "@/domain/text";
import { getLogger, parseDbDate } from "@/lib/logger";

const log = getLogger("d.m.engine.LearnerMemoryEngine");
import type { LessonRepository } from "@/domain/lesson/ports";
import { AttemptMemoryTransition } from "./attempt-memory-transition";
import type {
  ExerciseRepository,
  AttemptRepository,
  MistakePatternRepository,
  TransactionCoordinator,
  GradingEngine,
  JobDispatcher,
  ReviewPromptGenerator,
} from "./ports";
import type {
  LearnerMemoryEngine as LearnerMemoryEngineInterface,
  SubmitAttemptInput,
  AttemptFormResult,
  SubmitReviewAttemptInput,
  ReviewFormResult,
} from "./types";

export class DefaultLearnerMemoryEngine implements LearnerMemoryEngineInterface {
  constructor(
    private exerciseRepo: ExerciseRepository,
    _attemptRepo: AttemptRepository,
    private mistakePatternRepo: MistakePatternRepository,
    private txCoordinator: TransactionCoordinator,
    _lessonRepo: LessonRepository,
    private grader: GradingEngine,
    private dispatcher: JobDispatcher,
    private reviewGenerator: ReviewPromptGenerator,
    _textProcessor: TextProcessor,
    private attemptTransition = new AttemptMemoryTransition(
      _lessonRepo,
      _textProcessor
    )
  ) {}

  async submitAttempt(input: SubmitAttemptInput): Promise<AttemptFormResult> {
    try {
      const exercise = await this.exerciseRepo.findExercise(
        input.exerciseId,
        input.userId
      );
      if (!exercise) {
        return {
          success: false,
          isCorrect: false,
          score: 0,
          feedbackVi:
            "Bài tập không tồn tại hoặc không thuộc về người dùng này.",
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

      if (grade.systemFailure) {
        return {
          success: false,
          isCorrect: false,
          score: grade.score,
          feedbackVi: grade.feedbackVi,
          feedbackDetails: grade.feedbackDetails,
          userErrorCreated: false,
          mistakePatternStatus: "none",
          error: "Grading failed.",
        };
      }

      const transitionResult = await this.txCoordinator.runInTransaction(
        async (repos) => {
          return await this.attemptTransition.apply(
            {
              userId: input.userId,
              lessonId: input.lessonId,
              exercise,
              answer: input.answer,
              grade,
            },
            repos
          );
        }
      );

      if (transitionResult.reviewPromptJob) {
        this.dispatcher
          .triggerReviewPromptGeneration(
            transitionResult.reviewPromptJob.patternId
          )
          .catch((err) =>
            console.error(
              `[Engine] Failed to trigger review prompt generation: ${err}`
            )
          );
      }

      return {
        success: true,
        isCorrect: grade.isCorrect,
        score: grade.score,
        feedbackVi: grade.feedbackVi,
        feedbackDetails: grade.feedbackDetails,
        userErrorCreated: transitionResult.userErrorCreated,
        mistakePatternStatus: transitionResult.mistakePatternStatus,
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

  async submitReviewAttempt(
    input: SubmitReviewAttemptInput
  ): Promise<ReviewFormResult> {
    try {
      const pattern = await this.mistakePatternRepo.findMistakePattern(
        input.patternId,
        input.userId
      );
      if (!pattern) {
        return {
          success: false,
          isCorrect: false,
          score: 0,
          feedbackVi:
            "Lỗi ôn tập không tồn tại hoặc không thuộc về người dùng này.",
          masteryStateUpdated: false,
          error: "Mistake pattern not found.",
        };
      }

      const promptEn = pattern.reviewPromptEn ?? pattern.normalizedPhrase;
      const promptVi =
        pattern.reviewPromptVi ??
        `Dịch cụm từ hoặc câu sau sang nghĩa tự nhiên: "${pattern.normalizedPhrase}"`;
      const correctAnswer = pattern.reviewCorrectAnswer ?? pattern.meaningVi;
      const acceptableAnswers = pattern.reviewAcceptableAnswers ?? [];
      const rubricVi =
        pattern.reviewRubricVi ??
        `Đảm bảo người học hiểu đúng nghĩa tự nhiên của cụm từ "${pattern.normalizedPhrase}" là "${pattern.meaningVi}". Tránh dịch nghĩa đen.`;

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

      pattern.recordReviewAttempt(grade.isCorrect, grade.score);

      // 2. Perform persistence within transaction context
      await this.txCoordinator.runInTransaction(async (repos) => {
        await repos.attempts.createReviewAttempt({
          userId: input.userId,
          mistakePatternId: pattern.id,
          answer: input.answer,
          score: grade.score,
          isCorrect: grade.isCorrect,
          feedbackVi: grade.feedbackVi,
        });

        await repos.mistakePatterns.saveMistakePattern(pattern);
      });

      // 3. Trigger review prompt regeneration on success (outside transaction)
      if (grade.isCorrect) {
        this.dispatcher
          .triggerReviewPromptGeneration(pattern.id)
          .catch((err) =>
            console.error(
              `[Engine] Failed to trigger review prompt generation on success: ${err}`
            )
          );
      }

      return {
        success: true,
        isCorrect: grade.isCorrect,
        score: grade.score,
        feedbackVi: grade.feedbackVi,
        feedbackDetails: grade.feedbackDetails,
        masteryStateUpdated: true,
        masteryState: pattern.masteryState,
        nextReviewAt: pattern.dueAt,
        naturalAnswer: grade.naturalAnswer ?? correctAnswer,
      };
    } catch (error) {
      console.error(
        "[LearnerMemoryEngine] Error in submitReviewAttempt:",
        error
      );
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
      const pattern =
        await this.mistakePatternRepo.findMistakePatternById(patternId);
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

      pattern.updateReviewPrompt(generated);
      await this.mistakePatternRepo.saveMistakePattern(pattern);
      log.info(
        `Review prompt generated directly for pattern ${patternId} in ${Date.now() - startTime}ms.`
      );
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
      const pattern =
        await this.mistakePatternRepo.claimReviewPromptJob(workerId);
      if (!pattern) {
        return { status: "idle" };
      }

      const parsedLockedVal = parseDbDate(pattern.reviewPromptLockedAt);
      const queueLatency = parsedLockedVal
        ? Date.now() - parsedLockedVal.getTime()
        : 0;
      log.info(
        `Claimed review prompt job ${pattern.id} for pattern. Queue latency: ${queueLatency}ms.`,
        workerId
      );
      const startTime = Date.now();

      try {
        const generated = await this.reviewGenerator.generate({
          userId: pattern.userId,
          conceptPhrase: pattern.normalizedPhrase,
          conceptMeaningVi: pattern.meaningVi,
          category: pattern.category,
          errorType: pattern.errorType,
        });

        pattern.updateReviewPrompt(generated);
        await this.mistakePatternRepo.saveMistakePattern(pattern);

        log.info(
          `Review prompt job ${pattern.id} succeeded in ${Date.now() - startTime}ms.`,
          workerId
        );

        return {
          status: "processed",
          patternId: pattern.id,
          success: true,
        };
      } catch (genError) {
        const message =
          genError instanceof Error ? genError.message : String(genError);
        const attempts = pattern.reviewPromptAttempts ?? 0;

        log.warn(
          `Review prompt job ${pattern.id} failed (attempt ${attempts}): ${message}`,
          workerId
        );

        if (attempts < 3) {
          pattern.setJobStatus("queued", {
            reviewPromptError: message,
            reviewPromptLockedAt: null,
            reviewPromptLockedBy: null,
          });
        } else {
          pattern.setJobStatus("failed", {
            reviewPromptError: message,
            reviewPromptLockedAt: null,
            reviewPromptLockedBy: null,
          });
        }
        await this.mistakePatternRepo.saveMistakePattern(pattern);

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

  async getDashboardMetrics(userId: string, dueAt: Date) {
    return await this.mistakePatternRepo.getDashboardMetrics(userId, dueAt);
  }
}
