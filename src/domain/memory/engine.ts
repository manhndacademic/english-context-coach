import crypto from "crypto";
import type { TextProcessor } from "@/domain/text";
import type { ReviewPromptJobState } from "@/domain/types";
import { applyAttemptMemoryTransition } from "./engine/attempt";
import {
  submitReviewAttempt,
  submitPhrasePractice,
  generateReviewPrompt,
  generatePhrasePracticeReviewPrompt,
} from "./engine/review";
import { processNextReviewPromptJob } from "./engine/job-processor";
import type {
  ExerciseRepository,
  AttemptRepository,
  MistakePatternRepository,
  PhrasePracticeRepository,
  TransactionCoordinator,
  GradingEngine,
  ReviewPromptGenerator,
  MemoryLessonLookup,
  MemoryKeyPhraseInput,
} from "./ports";
import type {
  LearnerMemoryEngine as LearnerMemoryEngineInterface,
  SubmitAttemptInput,
  AttemptFormResult,
  SubmitReviewAttemptInput,
  ReviewFormResult,
  SubmitPhrasePracticeInput,
  PhrasePracticeFormResult,
} from "./types";

export class DefaultLearnerMemoryEngine implements LearnerMemoryEngineInterface {
  constructor(
    private exerciseRepo: ExerciseRepository,
    _attemptRepo: AttemptRepository,
    private mistakePatternRepo: MistakePatternRepository,
    private phrasePracticeRepo: PhrasePracticeRepository,
    private txCoordinator: TransactionCoordinator,
    private lessonRepo: MemoryLessonLookup,
    private grader: GradingEngine,
    private notifyQueue: () => Promise<void>,
    private reviewGenerator: ReviewPromptGenerator,
    private textProcessor: TextProcessor,
    private createId: () => string = () => crypto.randomUUID()
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
          return await applyAttemptMemoryTransition(
            {
              userId: input.userId,
              lessonId: input.lessonId,
              exercise,
              answer: input.answer,
              grade,
            },
            repos,
            this.lessonRepo,
            this.textProcessor,
            this.createId
          );
        }
      );

      if (transitionResult.reviewPromptJob) {
        this.notifyQueue().catch((err) =>
          console.error(`[Engine] Failed to notify queue: ${err}`)
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
    return submitReviewAttempt(input, {
      mistakePatternRepo: this.mistakePatternRepo,
      txCoordinator: this.txCoordinator,
      grader: this.grader,
      notifyQueue: this.notifyQueue,
    });
  }

  async submitPhrasePractice(
    input: SubmitPhrasePracticeInput
  ): Promise<PhrasePracticeFormResult> {
    return submitPhrasePractice(input, {
      phrasePracticeRepo: this.phrasePracticeRepo,
      txCoordinator: this.txCoordinator,
      grader: this.grader,
      notifyQueue: this.notifyQueue,
      createId: this.createId,
    });
  }

  async generateReviewPrompt(patternId: string): Promise<void> {
    return generateReviewPrompt(patternId, {
      mistakePatternRepo: this.mistakePatternRepo,
      reviewGenerator: this.reviewGenerator,
    });
  }

  async generatePhrasePracticeReviewPrompt(practiceId: string): Promise<void> {
    return generatePhrasePracticeReviewPrompt(practiceId, {
      phrasePracticeRepo: this.phrasePracticeRepo,
      reviewGenerator: this.reviewGenerator,
    });
  }

  async processNextReviewPromptJob(
    workerId: string
  ): Promise<ReviewPromptJobState> {
    return processNextReviewPromptJob(workerId, {
      mistakePatternRepo: this.mistakePatternRepo,
      phrasePracticeRepo: this.phrasePracticeRepo,
      reviewGenerator: this.reviewGenerator,
    });
  }

  async getDashboardMetrics(userId: string, dueAt: Date) {
    return await this.mistakePatternRepo.getDashboardMetrics(userId, dueAt);
  }

  async bulkCreateSrsCardsFromKeyPhrases(
    userId: string,
    keyPhrases: MemoryKeyPhraseInput[]
  ): Promise<{ inserted: number; skipped: number }> {
    return this.phrasePracticeRepo.bulkCreateFromKeyPhrases(userId, keyPhrases);
  }
}
