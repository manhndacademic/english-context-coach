import crypto from "crypto";
import type { TextProcessor } from "@/domain/text";
import { getLogger, parseDbDate } from "@/lib/logger";

const log = getLogger("d.m.engine.LearnerMemoryEngine");
import { MistakePattern } from "./mistake-pattern";
import type {
  ExerciseRepository,
  AttemptRepository,
  MistakePatternRepository,
  TransactionCoordinator,
  GradingEngine,
  ReviewPromptGenerator,
  LearnerGradingResult,
  MemoryLessonLookup,
  GradableExerciseInstance,
  MemoryKeyPhraseInput,
} from "./ports";
import type {
  LearnerMemoryEngine as LearnerMemoryEngineInterface,
  SubmitAttemptInput,
  AttemptFormResult,
  SubmitReviewAttemptInput,
  ReviewFormResult,
  Attempt,
} from "./types";

const MIN_USER_ERROR_CONFIDENCE = 70;

type MemoryCategory =
  | "idiom"
  | "phrasal_verb"
  | "technical_term"
  | "collocation"
  | "grammar_pattern"
  | "business_phrase"
  | "general_phrase";

type ResolvedMemoryConcept = {
  keyPhraseId: string | null;
  lessonFocusId: string | null;
  conceptKey: string;
  conceptPhrase: string;
  conceptMeaningVi: string;
  normalizedPhrase: string;
  senseKey: string;
  category: MemoryCategory;
  explanationVi: string;
  safeReviewPromptVi: string;
  isSensitive: boolean;
};

function categoryForLessonFocus(
  category: "tone" | "structure" | "purpose" | "context"
): MemoryCategory {
  if (category === "structure") return "grammar_pattern";
  if (category === "tone") return "business_phrase";
  return "general_phrase";
}

export class DefaultLearnerMemoryEngine implements LearnerMemoryEngineInterface {
  constructor(
    private exerciseRepo: ExerciseRepository,
    _attemptRepo: AttemptRepository,
    private mistakePatternRepo: MistakePatternRepository,
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
          return await this.applyAttemptMemoryTransition(
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
        type: pattern.reviewType as any,
        promptVi,
        promptEn,
        choices: pattern.reviewChoices,
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

      if (grade.isCorrect) {
        pattern.setJobStatus("queued", {
          reviewPromptAttempts: 0,
          reviewPromptError: null,
        });
      }

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
        this.notifyQueue().catch((err) =>
          console.error(`[Engine] Failed to notify queue on success: ${err}`)
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

  async bulkCreateSrsCardsFromKeyPhrases(
    userId: string,
    keyPhrases: MemoryKeyPhraseInput[]
  ): Promise<{ inserted: number; skipped: number }> {
    return this.mistakePatternRepo.bulkCreateFromKeyPhrases(userId, keyPhrases);
  }

  private async applyAttemptMemoryTransition(
    input: {
      userId: string;
      lessonId: string;
      exercise: GradableExerciseInstance;
      answer: string;
      grade: LearnerGradingResult;
    },
    repos: {
      attempts: AttemptRepository;
      mistakePatterns: MistakePatternRepository;
    }
  ): Promise<{
    attempt: Attempt;
    userErrorCreated: boolean;
    mistakePatternStatus: "new" | "repeated" | "none";
    reviewPromptJob?: { patternId: string };
  }> {
    const attempt = await repos.attempts.createAttempt({
      exerciseId: input.exercise.id,
      lessonId: input.lessonId,
      userId: input.userId,
      answer: input.answer,
      score: input.grade.score,
      isCorrect: input.grade.isCorrect,
      feedbackVi: input.grade.feedbackVi,
      gradingMetadata: input.grade,
    });

    if (!this.shouldCreateUserError(input.grade)) {
      return {
        attempt,
        userErrorCreated: false,
        mistakePatternStatus: "none",
      };
    }

    const errorData = input.grade.error!;
    const memory = await this.resolveMemoryConcept(input);

    if (memory.isSensitive) {
      await repos.attempts.createUserError({
        userId: input.userId,
        attemptId: attempt.id,
        lessonId: input.lessonId,
        keyPhraseId: memory.keyPhraseId,
        lessonFocusId: memory.lessonFocusId,
        errorType: errorData.errorType!,
        conceptKey: memory.conceptKey,
        normalizedPhrase: memory.conceptPhrase,
        senseKey: memory.senseKey,
        explanationVi: memory.explanationVi,
        isSourceSensitive: true,
        isRepeated: false,
      });

      return {
        attempt,
        userErrorCreated: true,
        mistakePatternStatus: "none",
      };
    }

    const existingPattern = await repos.mistakePatterns.findPatternByConcept(
      input.userId,
      memory.conceptKey,
      errorData.errorType!
    );
    const isRepeated = !!existingPattern;

    await repos.attempts.createUserError({
      userId: input.userId,
      attemptId: attempt.id,
      lessonId: input.lessonId,
      keyPhraseId: memory.keyPhraseId,
      lessonFocusId: memory.lessonFocusId,
      errorType: errorData.errorType!,
      conceptKey: memory.conceptKey,
      normalizedPhrase: memory.conceptPhrase,
      senseKey: memory.senseKey,
      explanationVi: memory.explanationVi,
      isSourceSensitive: false,
      isRepeated,
    });

    let pattern: MistakePattern;
    if (existingPattern) {
      existingPattern.incrementOccurrence();
      await repos.mistakePatterns.saveMistakePattern(existingPattern);
      pattern = existingPattern;
    } else {
      pattern = MistakePattern.createNew({
        id: this.createId(),
        userId: input.userId,
        conceptKey: memory.conceptKey,
        normalizedPhrase: memory.conceptPhrase,
        senseKey: memory.senseKey,
        category: memory.category,
        errorType: errorData.errorType,
        meaningVi: memory.conceptMeaningVi,
        safeReviewPromptVi: memory.safeReviewPromptVi,
        isSensitive: false,
      });
      pattern = await repos.mistakePatterns.upsertMistakePattern(pattern);
    }

    return {
      attempt,
      userErrorCreated: true,
      mistakePatternStatus: isRepeated ? "repeated" : "new",
      reviewPromptJob: pattern.needsReviewPromptGeneration()
        ? { patternId: pattern.id }
        : undefined,
    };
  }

  private shouldCreateUserError(grade: LearnerGradingResult): boolean {
    return Boolean(
      !grade.isCorrect &&
      grade.error?.shouldSave &&
      grade.error.confidence >= MIN_USER_ERROR_CONFIDENCE &&
      grade.error.errorType
    );
  }

  private async resolveMemoryConcept(input: {
    userId: string;
    lessonId: string;
    exercise: GradableExerciseInstance;
    answer: string;
    grade: LearnerGradingResult;
  }): Promise<ResolvedMemoryConcept> {
    const keyPhrase = input.exercise.keyPhraseId
      ? await this.lessonRepo.findKeyPhrase(input.exercise.keyPhraseId)
      : null;
    const lessonFocus = input.exercise.lessonFocusId
      ? await this.lessonRepo.findLessonFocus(input.exercise.lessonFocusId)
      : null;
    const errorData = input.grade.error!;
    const fallbackTarget =
      input.exercise.correctAnswer ??
      input.exercise.promptEn ??
      input.exercise.promptVi;
    const targetItem = fallbackTarget || errorData.targetItem || "";
    const normalizedPhrase =
      keyPhrase?.normalizedPhrase ??
      this.textProcessor.normalizePhrase(lessonFocus?.title ?? targetItem);
    const senseKey =
      keyPhrase?.senseKey ??
      this.textProcessor.normalizePhrase(
        `${lessonFocus?.category ?? "exercise"}:${lessonFocus?.title ?? targetItem}`
      );
    const category =
      keyPhrase?.category ??
      (lessonFocus
        ? categoryForLessonFocus(lessonFocus.category as any)
        : "general_phrase");
    const meaningVi =
      keyPhrase?.meaningVi ??
      lessonFocus?.explanationVi ??
      errorData.explanationVi ??
      "Ôn lại nghĩa tự nhiên trong ngữ cảnh.";
    const explanationVi = errorData.explanationVi ?? input.grade.feedbackVi;
    const conceptKey =
      keyPhrase?.conceptKey ??
      lessonFocus?.conceptKey ??
      this.textProcessor.normalizePhrase(targetItem);
    const conceptPhrase =
      keyPhrase?.conceptPhrase ??
      lessonFocus?.conceptPhrase ??
      normalizedPhrase;
    const conceptMeaningVi =
      keyPhrase?.conceptMeaningVi ?? lessonFocus?.conceptMeaningVi ?? meaningVi;
    const safeReviewPromptVi = `Ôn lại cụm "${conceptPhrase}" theo nghĩa tự nhiên trong ngữ cảnh.`;
    const originalPhrase =
      keyPhrase?.phrase ?? lessonFocus?.title ?? targetItem;

    const isSensitive =
      Boolean(keyPhrase?.isSensitive) ||
      this.textProcessor.shouldScrubMistakePattern({
        phrase: originalPhrase,
        meaningVi: conceptMeaningVi,
        safeReviewPromptVi,
      });

    return {
      keyPhraseId: keyPhrase?.id ?? null,
      lessonFocusId: lessonFocus ? lessonFocus.id : null,
      conceptKey,
      conceptPhrase,
      conceptMeaningVi,
      normalizedPhrase,
      senseKey,
      category,
      explanationVi,
      safeReviewPromptVi,
      isSensitive,
    };
  }
}
