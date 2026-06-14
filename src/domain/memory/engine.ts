import crypto from "crypto";
import type { TextProcessor } from "@/domain/text";
import { getLogger, parseDbDate } from "@/lib/logger";

const log = getLogger("d.m.engine.LearnerMemoryEngine");
import type { LessonRepository } from "@/domain/lesson/ports";
import { MistakePattern } from "./mistake-pattern";
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

function categoryForLessonFocus(
  category: "tone" | "structure" | "purpose" | "context"
) {
  if (category === "structure") return "grammar_pattern" as const;
  if (category === "tone") return "business_phrase" as const;
  return "general_phrase" as const;
}

export class DefaultLearnerMemoryEngine implements LearnerMemoryEngineInterface {
  constructor(
    private exerciseRepo: ExerciseRepository,
    private attemptRepo: AttemptRepository,
    private mistakePatternRepo: MistakePatternRepository,
    private txCoordinator: TransactionCoordinator,
    private lessonRepo: LessonRepository,
    private grader: GradingEngine,
    private dispatcher: JobDispatcher,
    private reviewGenerator: ReviewPromptGenerator,
    private textProcessor: TextProcessor
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
      let category:
        | "idiom"
        | "phrasal_verb"
        | "technical_term"
        | "collocation"
        | "grammar_pattern"
        | "business_phrase"
        | "general_phrase" = "general_phrase";
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
          lessonFocus = await this.lessonRepo.findLessonFocus(
            exercise.lessonFocusId
          );
        }

        const fallbackTarget =
          exercise.correctAnswer ?? exercise.promptEn ?? exercise.promptVi;
        targetItem = errorData.targetItem || fallbackTarget;

        normalizedPhrase =
          keyPhrase?.normalizedPhrase ??
          this.textProcessor.normalizePhrase(lessonFocus?.title ?? targetItem);
        senseKey =
          keyPhrase?.senseKey ??
          this.textProcessor.normalizePhrase(
            `${lessonFocus?.category ?? "exercise"}:${lessonFocus?.title ?? targetItem}`
          );
        category =
          keyPhrase?.category ??
          (lessonFocus
            ? categoryForLessonFocus(lessonFocus.category)
            : "general_phrase");
        meaningVi =
          keyPhrase?.meaningVi ??
          lessonFocus?.explanationVi ??
          errorData.explanationVi ??
          "Ôn lại nghĩa tự nhiên trong ngữ cảnh.";
        explanationVi = errorData.explanationVi ?? grade.feedbackVi;

        conceptKey =
          keyPhrase?.conceptKey ??
          lessonFocus?.conceptKey ??
          this.textProcessor.normalizePhrase(targetItem);
        conceptPhrase =
          keyPhrase?.conceptPhrase ??
          lessonFocus?.conceptPhrase ??
          normalizedPhrase;
        conceptMeaningVi =
          keyPhrase?.conceptMeaningVi ??
          lessonFocus?.conceptMeaningVi ??
          meaningVi;
      }

      const { insertedPattern, isRepeated } =
        await this.txCoordinator.runInTransaction(async (repos) => {
          let isRepeated = false;
          let insertedPattern: MistakePattern | null = null;

          const attempt = await repos.attempts.createAttempt({
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
            const existingPattern =
              await repos.mistakePatterns.findPatternByConcept(
                input.userId,
                conceptKey,
                errorData.errorType as any
              );

            isRepeated = !!existingPattern;

            await repos.attempts.createUserError({
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

            if (existingPattern) {
              existingPattern.incrementOccurrence();
              insertedPattern =
                await repos.mistakePatterns.upsertMistakePattern(
                  existingPattern
                );
            } else {
              const newPattern = MistakePattern.createNew({
                id: crypto.randomUUID(),
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
              insertedPattern =
                await repos.mistakePatterns.upsertMistakePattern(newPattern);
            }
          }

          return { insertedPattern, isRepeated };
        });

      // 3. Dispatch background prompt generation outside transaction
      if (insertedPattern && (!isRepeated || !insertedPattern.reviewPromptEn)) {
        this.dispatcher
          .triggerReviewPromptGeneration(insertedPattern.id)
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
        userErrorCreated: !!saveError,
        mistakePatternStatus: saveError
          ? isRepeated
            ? "repeated"
            : "new"
          : "none",
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

      pattern.recordReviewAttempt(grade.isCorrect);

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
