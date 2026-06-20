import type {
  MistakePatternRepository,
  PhrasePracticeRepository,
  TransactionCoordinator,
  GradingEngine,
  ReviewPromptGenerator,
  LearnerGradingResult,
} from "../ports";
import type {
  SubmitReviewAttemptInput,
  ReviewFormResult,
  SubmitPhrasePracticeInput,
  PhrasePracticeFormResult,
} from "../types";
import { MistakePattern } from "../mistake-pattern";
import { shouldCreateUserError } from "./attempt";
import { getLogger } from "@/lib/logger";

const log = getLogger("d.m.engine.ReviewHandler");

export async function submitReviewAttempt(
  input: SubmitReviewAttemptInput,
  deps: {
    mistakePatternRepo: MistakePatternRepository;
    txCoordinator: TransactionCoordinator;
    grader: GradingEngine;
    notifyQueue: () => Promise<void>;
  }
): Promise<ReviewFormResult> {
  const pattern = await deps.mistakePatternRepo.findMistakePattern(
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

  const createdAtDate = new Date(pattern.createdAt);
  const isRecent =
    pattern.draftPhrase &&
    Date.now() - createdAtDate.getTime() <= 7 * 24 * 60 * 60 * 1000;

  let grade: LearnerGradingResult;
  if (isRecent) {
    const isAnswerCorrect =
      input.answer.trim().toLowerCase() ===
      pattern.normalizedPhrase.trim().toLowerCase();
    grade = {
      score: isAnswerCorrect ? 100 : 0,
      isCorrect: isAnswerCorrect,
      feedbackVi: isAnswerCorrect
        ? "Chính xác! Bạn đã ghi nhớ đúng cụm từ."
        : `Chưa chính xác. Cụm từ đúng là: "${pattern.normalizedPhrase}".`,
      naturalAnswer: pattern.normalizedPhrase,
    };
  } else {
    grade = await deps.grader.grade({
      userId: input.userId,
      lessonId: undefined,
      exercise: mockExercise,
      answer: input.answer,
    });
  }

  pattern.recordReviewAttempt(grade.isCorrect, grade.score);

  if (grade.isCorrect) {
    pattern.setJobStatus("queued", {
      reviewPromptAttempts: 0,
      reviewPromptError: null,
    });
  }

  await deps.txCoordinator.runInTransaction(async (repos) => {
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

  if (grade.isCorrect) {
    deps
      .notifyQueue()
      .catch((err) =>
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
    literalTranslationTrap: grade.literalTranslationTrap,
  };
}

export async function submitPhrasePractice(
  input: SubmitPhrasePracticeInput,
  deps: {
    phrasePracticeRepo: PhrasePracticeRepository;
    txCoordinator: TransactionCoordinator;
    grader: GradingEngine;
    notifyQueue: () => Promise<void>;
    createId: () => string;
  }
): Promise<PhrasePracticeFormResult> {
  const practice = await deps.phrasePracticeRepo.findPhrasePractice(
    input.practiceId,
    input.userId
  );
  if (!practice) {
    return {
      success: false,
      isCorrect: false,
      score: 0,
      feedbackVi:
        "Luyện tập cụm từ không tồn tại hoặc không thuộc về người dùng này.",
      masteryStateUpdated: false,
      error: "Phrase practice not found.",
    };
  }

  const promptEn = practice.reviewPromptEn ?? practice.normalizedPhrase;
  const promptVi =
    practice.reviewPromptVi ??
    `Dịch cụm từ hoặc câu sau sang nghĩa tự nhiên: "${practice.normalizedPhrase}"`;
  const correctAnswer = practice.reviewCorrectAnswer ?? practice.meaningVi;
  const acceptableAnswers = practice.reviewAcceptableAnswers ?? [];
  const rubricVi =
    practice.reviewRubricVi ??
    `Đảm bảo người học hiểu đúng nghĩa tự nhiên của cụm từ "${practice.normalizedPhrase}" là "${practice.meaningVi}". Tránh dịch nghĩa đen.`;

  const mockExercise = {
    id: practice.id,
    lessonId: "review",
    userId: input.userId,
    type: practice.reviewType as any,
    promptVi,
    promptEn,
    choices: practice.reviewChoices,
    correctAnswer,
    acceptableAnswers,
    rubricVi,
    keyPhraseId: null,
    lessonFocusId: null,
    orderIndex: 0,
    createdAt: new Date(),
  };

  const createdAtDate = new Date(practice.createdAt);
  const isRecent =
    practice.draftPhrase &&
    Date.now() - createdAtDate.getTime() <= 7 * 24 * 60 * 60 * 1000;

  let grade: LearnerGradingResult;
  if (isRecent) {
    const isAnswerCorrect =
      input.answer.trim().toLowerCase() ===
      practice.normalizedPhrase.trim().toLowerCase();
    grade = {
      score: isAnswerCorrect ? 100 : 0,
      isCorrect: isAnswerCorrect,
      feedbackVi: isAnswerCorrect
        ? "Chính xác! Bạn đã ghi nhớ đúng cụm từ."
        : `Chưa chính xác. Cụm từ đúng là: "${practice.normalizedPhrase}".`,
      naturalAnswer: practice.normalizedPhrase,
    };
  } else {
    grade = await deps.grader.grade({
      userId: input.userId,
      lessonId: undefined,
      exercise: mockExercise,
      answer: input.answer,
    });
  }

  practice.recordReviewAttempt(grade.isCorrect, grade.score);

  if (grade.isCorrect) {
    practice.setJobStatus("queued", {
      reviewPromptAttempts: 0,
      reviewPromptError: null,
    });
  }

  await deps.txCoordinator.runInTransaction(async (repos) => {
    await repos.attempts.createPhrasePracticeAttempt({
      userId: input.userId,
      phrasePracticeId: practice.id,
      answer: input.answer,
      score: grade.score,
      isCorrect: grade.isCorrect,
      feedbackVi: grade.feedbackVi,
    });

    if (!grade.isCorrect && shouldCreateUserError(grade)) {
      const errorData = grade.error!;
      const existingPattern = await repos.mistakePatterns.findPatternByConcept(
        practice.userId,
        practice.conceptKey,
        errorData.errorType!
      );
      const isRepeated = !!existingPattern;

      await repos.attempts.createUserError({
        userId: practice.userId,
        attemptId: null,
        lessonId: null,
        keyPhraseId: practice.keyPhraseId,
        lessonFocusId: null,
        errorType: errorData.errorType!,
        conceptKey: practice.conceptKey,
        normalizedPhrase: practice.normalizedPhrase,
        senseKey: practice.senseKey ?? "",
        explanationVi: grade.feedbackVi,
        isSourceSensitive: practice.isSensitive,
        isRepeated,
      });

      if (existingPattern) {
        existingPattern.incrementOccurrence();
        await repos.mistakePatterns.saveMistakePattern(existingPattern);
      } else {
        const newPattern = MistakePattern.createNew({
          id: deps.createId(),
          userId: practice.userId,
          conceptKey: practice.conceptKey,
          normalizedPhrase: practice.normalizedPhrase,
          senseKey: practice.senseKey,
          category: practice.category,
          errorType: errorData.errorType!,
          meaningVi: practice.meaningVi,
          safeReviewPromptVi: practice.meaningVi,
          isSensitive: practice.isSensitive,
          draftPhrase: practice.draftPhrase,
        });
        await repos.mistakePatterns.upsertMistakePattern(newPattern);
      }
    }

    await repos.phrasePractices.savePhrasePractice(practice);
  });

  if (grade.isCorrect) {
    deps
      .notifyQueue()
      .catch((err) =>
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
    masteryState: practice.masteryState,
    nextReviewAt: practice.dueAt,
    naturalAnswer: grade.naturalAnswer ?? correctAnswer,
    literalTranslationTrap: grade.literalTranslationTrap,
  };
}

export async function generateReviewPrompt(
  patternId: string,
  deps: {
    mistakePatternRepo: MistakePatternRepository;
    reviewGenerator: ReviewPromptGenerator;
  }
): Promise<void> {
  try {
    const pattern =
      await deps.mistakePatternRepo.findMistakePatternById(patternId);
    if (!pattern) return;

    log.info(`Generating review prompt directly for pattern ${patternId}...`);
    const startTime = Date.now();
    const generated = await deps.reviewGenerator.generate({
      userId: pattern.userId,
      conceptPhrase: pattern.normalizedPhrase,
      conceptMeaningVi: pattern.meaningVi,
      category: pattern.category,
      errorType: pattern.errorType,
    });

    pattern.updateReviewPrompt(generated);
    await deps.mistakePatternRepo.saveMistakePattern(pattern);
    log.info(
      `Review prompt generated directly for pattern ${patternId} in ${Date.now() - startTime}ms.`
    );
  } catch (error) {
    log.error(`generateReviewPrompt failed for pattern ${patternId}`, error);
  }
}

export async function generatePhrasePracticeReviewPrompt(
  practiceId: string,
  deps: {
    phrasePracticeRepo: PhrasePracticeRepository;
    reviewGenerator: ReviewPromptGenerator;
  }
): Promise<void> {
  try {
    const practice =
      await deps.phrasePracticeRepo.findPhrasePracticeById(practiceId);
    if (!practice) return;

    log.info(
      `Generating review prompt directly for phrase practice ${practiceId}...`
    );
    const startTime = Date.now();
    const generated = await deps.reviewGenerator.generate({
      userId: practice.userId,
      conceptPhrase: practice.normalizedPhrase,
      conceptMeaningVi: practice.meaningVi,
      category: practice.category,
      errorType: "phrase_misunderstanding",
    });

    practice.updateReviewPrompt(generated);
    await deps.phrasePracticeRepo.savePhrasePractice(practice);
    log.info(
      `Review prompt generated directly for phrase practice ${practiceId} in ${Date.now() - startTime}ms.`
    );
  } catch (error) {
    log.error(
      `generatePhrasePracticeReviewPrompt failed for practice ${practiceId}`,
      error
    );
  }
}
