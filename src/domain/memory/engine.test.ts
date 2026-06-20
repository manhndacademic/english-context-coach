import { describe, expect, it, beforeEach } from "vitest";
import { DefaultLearnerMemoryEngine } from "./engine";
import { getTextProcessor } from "@/domain/text";
import { MistakePattern } from "./mistake-pattern";
import type {
  ExerciseRepository,
  AttemptRepository,
  MistakePatternRepository,
  PhrasePracticeRepository,
  TransactionCoordinator,
  GradingEngine,
  ReviewPromptGenerator,
  MemoryLessonLookup,
} from "./ports";

class MockDatabaseState {
  exercises = new Map<string, any>();
  mistakePatterns = new Map<string, any>();
  phrasePractices = new Map<string, any>();
  attempts: any[] = [];
  userErrors: any[] = [];
  reviewAttempts: any[] = [];

  async upsertMistakePattern(input: any) {
    const existing = Array.from(this.mistakePatterns.values()).find(
      (p) =>
        p.userId === input.userId &&
        p.conceptKey === input.conceptKey &&
        p.errorType === input.errorType
    );
    if (existing) {
      existing.incrementOccurrence();
      return existing;
    }
    const created = MistakePattern.createNew({
      id: input.id ?? `pattern-${this.mistakePatterns.size + 1}`,
      userId: input.userId,
      conceptKey: input.conceptKey,
      normalizedPhrase: input.normalizedPhrase,
      senseKey: input.senseKey ?? null,
      category: input.category,
      errorType: input.errorType,
      meaningVi: input.meaningVi,
      safeReviewPromptVi: input.safeReviewPromptVi,
      isSensitive: input.isSensitive ?? false,
    });
    if (
      input.reviewPromptStatus ||
      input.intervalDays ||
      input.masteryState ||
      input.reviewPromptEn
    ) {
      const reconstituted = MistakePattern.reconstitute({
        ...created.toDbRow(),
        ...input,
      });
      this.mistakePatterns.set(reconstituted.id, reconstituted);
      return reconstituted;
    }
    this.mistakePatterns.set(created.id, created);
    return created;
  }
}

class MockExerciseRepository implements ExerciseRepository {
  constructor(private state: MockDatabaseState) {}

  async findExercise(exerciseId: string, userId: string) {
    const exercise = this.state.exercises.get(exerciseId);
    if (exercise && exercise.userId === userId) return exercise;
    return null;
  }
}

class MockAttemptRepository implements AttemptRepository {
  constructor(private state: MockDatabaseState) {}

  async createAttempt(attempt: any) {
    const created = {
      id: `attempt-${this.state.attempts.length + 1}`,
      createdAt: new Date(),
      ...attempt,
    };
    this.state.attempts.push(created);
    return created;
  }

  async createReviewAttempt(attempt: any) {
    const created = {
      id: `review-attempt-${this.state.reviewAttempts.length + 1}`,
      createdAt: new Date(),
      ...attempt,
    };
    this.state.reviewAttempts.push(created);
    return created;
  }

  async createPhrasePracticeAttempt(attempt: any) {
    const created = {
      id: `phrase-practice-attempt-${this.state.reviewAttempts.length + 1}`,
      createdAt: new Date(),
      ...attempt,
    };
    this.state.reviewAttempts.push(created);
    return created;
  }

  async createUserError(error: any) {
    const created = {
      id: `user-error-${this.state.userErrors.length + 1}`,
      createdAt: new Date(),
      ...error,
    };
    this.state.userErrors.push(created);
    return created;
  }
}

class MockMistakePatternRepository implements MistakePatternRepository {
  constructor(private state: MockDatabaseState) {}

  async findMistakePattern(patternId: string, userId: string) {
    const pattern = this.state.mistakePatterns.get(patternId);
    if (pattern && pattern.userId === userId) return pattern;
    return null;
  }

  async findMistakePatternById(patternId: string) {
    return this.state.mistakePatterns.get(patternId) ?? null;
  }

  async findPatternByConcept(
    userId: string,
    conceptKey: string,
    errorType: string
  ) {
    for (const pattern of this.state.mistakePatterns.values()) {
      if (
        pattern.userId === userId &&
        pattern.conceptKey === conceptKey &&
        pattern.errorType === errorType
      ) {
        return pattern;
      }
    }
    return null;
  }

  async upsertMistakePattern(pattern: MistakePattern) {
    this.state.mistakePatterns.set(pattern.id, pattern);
    return pattern;
  }

  async saveMistakePattern(pattern: MistakePattern) {
    this.state.mistakePatterns.set(pattern.id, pattern);
  }

  async claimReviewPromptJob(workerId: string) {
    for (const pattern of this.state.mistakePatterns.values()) {
      if (pattern.reviewPromptStatus === "queued") {
        pattern.claimJob(workerId);
        return pattern;
      }
    }
    return null;
  }

  async findDueMistakePatterns(userId: string, dueAt: Date, limit: number) {
    return Array.from(this.state.mistakePatterns.values())
      .filter(
        (pattern) =>
          pattern.userId === userId &&
          pattern.masteryState === "active" &&
          pattern.reviewPromptStatus === "succeeded" &&
          pattern.dueAt <= dueAt
      )
      .slice(0, limit);
  }

  async findAllMistakePatterns(userId: string) {
    return Array.from(this.state.mistakePatterns.values())
      .filter((pattern) => pattern.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async bulkCreateFromKeyPhrases(_userId: string, phrases: any[]) {
    return { inserted: phrases.length, skipped: 0 };
  }

  async scrubSensitiveContentForSourceText(
    _userId: string,
    _sourceTextId: string
  ) {}

  async getLessonsForPatterns(_userId: string) {
    return {};
  }

  async getDashboardMetrics(_userId: string, _dueAt: Date) {
    return {
      dueCount: 0,
      patternCount: 0,
      repeatedMistakes: [],
      learningStreakDays: 0,
      masteredCount: 0,
      reviewSuccessRate: 0,
      masteredTrend: [],
      exercisesCompleted: 0,
      lessonsCompleted: 0,
      literalErrorTrend: [],
    };
  }
}

class MockPhrasePracticeRepository implements PhrasePracticeRepository {
  constructor(private state: MockDatabaseState) {}

  async findPhrasePractice(practiceId: string, userId: string) {
    const practice = this.state.phrasePractices.get(practiceId);
    if (practice && practice.userId === userId) return practice;
    return null;
  }

  async findPhrasePracticeById(practiceId: string) {
    return this.state.phrasePractices.get(practiceId) ?? null;
  }

  async findPracticeByConcept(userId: string, conceptKey: string) {
    for (const practice of this.state.phrasePractices.values()) {
      if (practice.userId === userId && practice.conceptKey === conceptKey) {
        return practice;
      }
    }
    return null;
  }

  async upsertPhrasePractice(practice: any) {
    this.state.phrasePractices.set(practice.id, practice);
    return practice;
  }

  async savePhrasePractice(practice: any) {
    this.state.phrasePractices.set(practice.id, practice);
  }

  async claimReviewPromptJob(workerId: string) {
    for (const practice of this.state.phrasePractices.values()) {
      if (practice.reviewPromptStatus === "queued") {
        practice.claimJob(workerId);
        return practice;
      }
    }
    return null;
  }

  async findDuePhrasePractices(userId: string, dueAt: Date, limit: number) {
    return Array.from(this.state.phrasePractices.values())
      .filter(
        (practice) =>
          practice.userId === userId &&
          practice.masteryState === "active" &&
          practice.reviewPromptStatus === "succeeded" &&
          practice.dueAt <= dueAt
      )
      .slice(0, limit);
  }

  async findAllPhrasePractices(userId: string) {
    return Array.from(this.state.phrasePractices.values())
      .filter((practice) => practice.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async bulkCreateFromKeyPhrases(_userId: string, phrases: any[]) {
    return { inserted: phrases.length, skipped: 0 };
  }
}

class MockTransactionCoordinator implements TransactionCoordinator {
  active = false;
  runCount = 0;
  events: string[] = [];

  constructor(
    private exerciseRepo: ExerciseRepository,
    private attemptRepo: AttemptRepository,
    private mistakePatternRepo: MistakePatternRepository,
    private phrasePracticeRepo: PhrasePracticeRepository
  ) {}

  async runInTransaction<T>(
    operation: (repos: {
      exercises: ExerciseRepository;
      attempts: AttemptRepository;
      mistakePatterns: MistakePatternRepository;
      phrasePractices: PhrasePracticeRepository;
    }) => Promise<T>
  ): Promise<T> {
    this.runCount += 1;
    this.active = true;
    this.events.push("tx:start");
    try {
      return await operation({
        exercises: this.exerciseRepo,
        attempts: this.attemptRepo,
        mistakePatterns: this.mistakePatternRepo,
        phrasePractices: this.phrasePracticeRepo,
      });
    } finally {
      this.active = false;
      this.events.push("tx:end");
    }
  }
}

class MockGradingEngine implements GradingEngine {
  result: any = {
    score: 100,
    isCorrect: true,
    feedbackVi: "Chính xác!",
  };
  onGrade?: () => void;
  lastInput?: any;

  async grade(input: any) {
    this.lastInput = input;
    this.onGrade?.();
    return this.result;
  }
}

class MockReviewPromptGenerator implements ReviewPromptGenerator {
  result = {
    reviewType: "natural_translation",
    reviewPromptEn: "Mock Prompt En",
    reviewPromptVi: "Mock Prompt Vi",
    reviewRubricVi: "Mock Rubric Vi",
    reviewCorrectAnswer: "Mock Correct Answer",
    reviewAcceptableAnswers: ["Acceptable Answer"],
    reviewChoices: null as string[] | null,
  };
  error: Error | null = null;

  async generate(_input: any) {
    if (this.error) throw this.error;
    return this.result;
  }
}

class MockLessonRepository implements MemoryLessonLookup {
  keyPhrases = new Map<string, any>();
  lessonFocuses = new Map<string, any>();

  async findKeyPhrase(keyPhraseId: string) {
    return this.keyPhrases.get(keyPhraseId) ?? null;
  }

  async findLessonFocus(lessonFocusId: string) {
    return this.lessonFocuses.get(lessonFocusId) ?? null;
  }
}

describe("LearnerMemoryEngine Domain Orchestrator", () => {
  let repo: MockDatabaseState;
  let exerciseRepo: MockExerciseRepository;
  let attemptRepo: MockAttemptRepository;
  let mistakePatternRepo: MockMistakePatternRepository;
  let txCoordinator: MockTransactionCoordinator;
  let lessonRepo: MockLessonRepository;
  let grader: MockGradingEngine;
  let notifyQueueCalls: number;
  let notifyQueue: () => Promise<void>;
  let reviewGenerator: MockReviewPromptGenerator;
  let engine: DefaultLearnerMemoryEngine;

  beforeEach(() => {
    repo = new MockDatabaseState();
    exerciseRepo = new MockExerciseRepository(repo);
    attemptRepo = new MockAttemptRepository(repo);
    mistakePatternRepo = new MockMistakePatternRepository(repo);
    const phrasePracticeRepo = new MockPhrasePracticeRepository(repo);
    txCoordinator = new MockTransactionCoordinator(
      exerciseRepo,
      attemptRepo,
      mistakePatternRepo,
      phrasePracticeRepo
    );
    lessonRepo = new MockLessonRepository();
    grader = new MockGradingEngine();
    notifyQueueCalls = 0;
    notifyQueue = async () => {
      notifyQueueCalls++;
    };
    reviewGenerator = new MockReviewPromptGenerator();
    engine = new DefaultLearnerMemoryEngine(
      exerciseRepo,
      attemptRepo,
      mistakePatternRepo,
      phrasePracticeRepo,
      txCoordinator,
      lessonRepo,
      grader,
      notifyQueue,
      reviewGenerator,
      getTextProcessor(),
      () => `pattern-${repo.mistakePatterns.size + 1}`
    );
  });

  describe("submitAttempt", () => {
    it("returns error state if exercise not found", async () => {
      const result = await engine.submitAttempt({
        userId: "user-1",
        exerciseId: "ex-nonexistent",
        lessonId: "les-1",
        answer: "hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Exercise not found.");
      expect(repo.attempts.length).toBe(0);
    });

    it("does not persist an attempt when grading fails as a system failure", async () => {
      repo.exercises.set("ex-1", {
        id: "ex-1",
        userId: "user-1",
        correctAnswer: "correct text",
      });
      grader.result = {
        score: 0,
        isCorrect: false,
        systemFailure: true,
        feedbackVi: "Chưa thể chấm câu trả lời này.",
        error: {
          shouldSave: false,
          confidence: 0,
          errorType: "phrase_misunderstanding",
        },
      };

      const result = await engine.submitAttempt({
        userId: "user-1",
        exerciseId: "ex-1",
        lessonId: "les-1",
        answer: "hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Grading failed.");
      expect(repo.attempts.length).toBe(0);
      expect(repo.userErrors.length).toBe(0);
      expect(repo.mistakePatterns.size).toBe(0);
      expect(txCoordinator.runCount).toBe(0);
    });

    it("grades outside the transaction, runs the transition inside it, and maps the result", async () => {
      repo.exercises.set("ex-1", {
        id: "ex-1",
        userId: "user-1",
        correctAnswer: "correct text",
      });
      const events: string[] = [];
      grader.result = {
        score: 82,
        isCorrect: false,
        feedbackVi: "Chưa đúng.",
        feedbackDetails: {
          whatWasWrong: "Sai",
          whyItWasWrong: "Sai nghĩa",
          correctUnderstanding: "Đúng nghĩa",
          mistakeType: "Lỗi ngữ cảnh",
          detailedExplanation: "Chi tiết...",
        },
        error: {
          shouldSave: true,
          confidence: 90,
          errorType: "phrase_misunderstanding",
          explanationVi: "Lỗi dịch nghĩa.",
          targetItem: "correct text",
        },
      };
      grader.onGrade = () => {
        events.push(txCoordinator.active ? "grade:in-tx" : "grade:outside-tx");
      };

      const originalCreateAttempt = attemptRepo.createAttempt;
      attemptRepo.createAttempt = async (attempt: any) => {
        events.push(
          txCoordinator.active ? "transition:in-tx" : "transition:outside-tx"
        );
        return originalCreateAttempt.call(attemptRepo, attempt);
      };

      const result = await engine.submitAttempt({
        userId: "user-1",
        exerciseId: "ex-1",
        lessonId: "les-1",
        answer: "wrong text",
      });

      expect(result.success).toBe(true);
      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(82);
      expect(result.userErrorCreated).toBe(true);
      expect(result.mistakePatternStatus).toBe("new");
      expect(result.feedbackDetails?.mistakeType).toBe("Lỗi ngữ cảnh");
      expect(txCoordinator.runCount).toBe(1);
      expect(events).toEqual(["grade:outside-tx", "transition:in-tx"]);
      expect(notifyQueueCalls).toBe(1);

      // Verify records are actually written to DB
      expect(repo.attempts).toHaveLength(1);
      expect(repo.attempts[0]).toMatchObject({
        userId: "user-1",
        lessonId: "les-1",
        answer: "wrong text",
        score: 82,
        isCorrect: false,
      });
      expect(repo.userErrors).toHaveLength(1);
      expect(repo.userErrors[0].errorType).toBe("phrase_misunderstanding");
      expect(repo.mistakePatterns.size).toBe(1);
    });

    it("dispatches the review prompt job only after the transaction completes", async () => {
      repo.exercises.set("ex-1", {
        id: "ex-1",
        userId: "user-1",
        correctAnswer: "correct text",
      });
      const events: string[] = [];
      grader.result = {
        score: 82,
        isCorrect: false,
        feedbackVi: "Chưa đúng.",
        error: {
          shouldSave: true,
          confidence: 90,
          errorType: "phrase_misunderstanding",
          explanationVi: "Lỗi dịch nghĩa.",
          targetItem: "correct text",
        },
      };
      grader.onGrade = () => {
        events.push("grade");
      };

      const originalCreateAttempt = attemptRepo.createAttempt;
      attemptRepo.createAttempt = async (attempt: any) => {
        events.push("transition");
        return originalCreateAttempt.call(attemptRepo, attempt);
      };

      const notifyQueueFn = async () => {
        events.push(
          txCoordinator.active ? "dispatch:in-tx" : "dispatch:after-tx"
        );
        notifyQueueCalls++;
      };

      const phrasePracticeRepo = new MockPhrasePracticeRepository(repo);
      engine = new DefaultLearnerMemoryEngine(
        exerciseRepo,
        attemptRepo,
        mistakePatternRepo,
        phrasePracticeRepo,
        txCoordinator,
        lessonRepo,
        grader,
        notifyQueueFn,
        reviewGenerator,
        getTextProcessor(),
        () => `pattern-${repo.mistakePatterns.size + 1}`
      );

      await engine.submitAttempt({
        userId: "user-1",
        exerciseId: "ex-1",
        lessonId: "les-1",
        answer: "wrong text",
      });

      expect(notifyQueueCalls).toBe(1);
      expect(events).toEqual(["grade", "transition", "dispatch:after-tx"]);
      expect(txCoordinator.events).toEqual(["tx:start", "tx:end"]);
    });

    describe("state transitions", () => {
      const runTransition = async (
        exerciseOverrides: any,
        gradeOverrides: any
      ) => {
        const exercise = {
          id: "exercise-1",
          lessonId: "lesson-1",
          userId: "user-1",
          keyPhraseId: null,
          lessonFocusId: null,
          type: "natural_translation",
          promptVi: "Dịch tự nhiên.",
          promptEn: "Could you push this back?",
          choices: null,
          correctAnswer: "dời việc này lại",
          acceptableAnswers: null,
          rubricVi: null,
          orderIndex: 1,
          createdAt: new Date(),
          ...exerciseOverrides,
        };
        repo.exercises.set(exercise.id, exercise);

        grader.result = {
          score: 0,
          isCorrect: false,
          feedbackVi: "Chưa đúng.",
          error: {
            shouldSave: true,
            confidence: 90,
            errorType: "phrase_misunderstanding",
            explanationVi: "Sai nghĩa cụm.",
            targetItem: "AI target should not win",
          },
          ...gradeOverrides,
        };

        return await engine.submitAttempt({
          userId: "user-1",
          exerciseId: exercise.id,
          lessonId: "lesson-1",
          answer: "wrong answer",
        });
      };

      it("saves an attempt without user memory when shouldSave is false", async () => {
        const result = await runTransition(
          {},
          {
            error: {
              shouldSave: false,
              confidence: 100,
              errorType: "phrase_misunderstanding",
              explanationVi: "Không nên lưu.",
              targetItem: "push back",
            },
          }
        );

        expect(result.userErrorCreated).toBe(false);
        expect(result.mistakePatternStatus).toBe("none");
        expect(repo.attempts).toHaveLength(1);
        expect(repo.userErrors).toHaveLength(0);
        expect(repo.mistakePatterns.size).toBe(0);
      });

      it("saves an attempt without user memory when confidence is below the gate", async () => {
        const result = await runTransition(
          {},
          {
            error: {
              shouldSave: true,
              confidence: 69,
              errorType: "phrase_misunderstanding",
              explanationVi: "Không đủ chắc.",
              targetItem: "push back",
            },
          }
        );

        expect(result.userErrorCreated).toBe(false);
        expect(repo.attempts).toHaveLength(1);
        expect(repo.userErrors).toHaveLength(0);
      });

      it("saves user error when confidence is exactly at the gate", async () => {
        const result = await runTransition(
          {},
          {
            error: {
              shouldSave: true,
              confidence: 70,
              errorType: "phrase_misunderstanding",
              explanationVi: "Vừa đủ chắc.",
              targetItem: "push back",
            },
          }
        );

        expect(result.userErrorCreated).toBe(true);
        expect(repo.attempts).toHaveLength(1);
        expect(repo.userErrors).toHaveLength(1);
      });

      it("uses KeyPhrase concept as authoritative over AI targetItem", async () => {
        lessonRepo.keyPhrases.set("phrase-1", {
          id: "phrase-1",
          conceptKey: "push_back",
          conceptPhrase: "push back",
          conceptMeaningVi: "dời lại / trì hoãn",
          normalizedPhrase: "push back",
          senseKey: "push_back_sense",
          meaningVi: "dời lại / trì hoãn",
          category: "phrasal_verb",
          isSensitive: false,
        });

        await runTransition({ keyPhraseId: "phrase-1" }, {});

        expect(repo.userErrors[0].conceptKey).toBe("push_back");
        expect(repo.userErrors[0].normalizedPhrase).toBe("push back");
        expect(Array.from(repo.mistakePatterns.values())[0].meaningVi).toBe(
          "dời lại / trì hoãn"
        );
      });

      it("uses LessonFocus concept when there is no KeyPhrase", async () => {
        lessonRepo.lessonFocuses.set("focus-1", {
          id: "focus-1",
          title: "Lời nhờ lịch sự",
          conceptKey: "polite_request",
          conceptPhrase: "polite request",
          conceptMeaningVi: "nhờ vả lịch sự, không gây áp lực",
          category: "tone",
          explanationVi: "Dùng sắc thái mềm.",
        });

        await runTransition({ lessonFocusId: "focus-1" }, {});

        const pattern = Array.from(repo.mistakePatterns.values())[0];
        expect(repo.userErrors[0].conceptKey).toBe("polite_request");
        expect(pattern.normalizedPhrase).toBe("polite request");
        expect(pattern.category).toBe("business_phrase");
      });

      it("uses exercise fallback before AI targetItem when no concept owner exists", async () => {
        await runTransition(
          {
            correctAnswer: "dời việc này lại",
            promptEn: "Could you push this back?",
          },
          {}
        );

        expect(repo.userErrors[0].conceptKey).toBe("dời việc này lại");
        expect(repo.userErrors[0].conceptKey).not.toBe(
          "ai target should not win"
        );
      });

      it("creates a new MistakePattern and returns a review prompt job", async () => {
        const result = await runTransition({}, {});

        expect(result.userErrorCreated).toBe(true);
        expect(result.mistakePatternStatus).toBe("new");
        expect(repo.mistakePatterns.size).toBe(1);
        const pattern = Array.from(repo.mistakePatterns.values())[0];
        expect(pattern.reviewPromptStatus).toBe("queued");
      });

      it("updates repeated MistakePattern through aggregate state and save", async () => {
        const existing = MistakePattern.createNew({
          id: "existing-pattern",
          userId: "user-1",
          conceptKey: "dời việc này lại",
          normalizedPhrase: "dời việc này lại",
          senseKey: "exercise:dời việc này lại",
          category: "general_phrase",
          errorType: "phrase_misunderstanding",
          meaningVi: "Sai nghĩa cụm.",
          safeReviewPromptVi:
            'Ôn lại cụm "dời việc này lại" theo nghĩa tự nhiên trong ngữ cảnh.',
          isSensitive: false,
        });
        repo.mistakePatterns.set(existing.id, existing);

        const result = await runTransition({}, {});

        expect(result.mistakePatternStatus).toBe("repeated");
        expect(repo.userErrors[0].isRepeated).toBe(true);
        expect(existing.occurrenceCount).toBe(2);
        expect(existing.intervalDays).toBe(0);
      });

      it("reactivates a mastered MistakePattern immediately when missed again", async () => {
        const mastered = MistakePattern.reconstitute({
          ...MistakePattern.createNew({
            id: "mastered-pattern",
            userId: "user-1",
            conceptKey: "dời việc này lại",
            normalizedPhrase: "dời việc này lại",
            senseKey: "exercise:dời việc này lại",
            category: "general_phrase",
            errorType: "phrase_misunderstanding",
            meaningVi: "Sai nghĩa cụm.",
            safeReviewPromptVi:
              'Ôn lại cụm "dời việc này lại" theo nghĩa tự nhiên trong ngữ cảnh.',
            isSensitive: false,
          }).toDbRow(),
          occurrenceCount: 3,
          intervalDays: 14,
          masteryState: "mastered",
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        repo.mistakePatterns.set(mastered.id, mastered);

        await runTransition({}, {});

        expect(mastered.occurrenceCount).toBe(4);
        expect(mastered.intervalDays).toBe(0);
        expect(mastered.masteryState).toBe("active");
        expect(mastered.dueAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
      });

      it("saves sensitive KeyPhrase UserError without long-term MistakePattern memory", async () => {
        lessonRepo.keyPhrases.set("phrase-1", {
          id: "phrase-1",
          conceptKey: "internal_customer",
          conceptPhrase: "internal customer",
          conceptMeaningVi: "khách hàng nội bộ",
          normalizedPhrase: "internal customer",
          senseKey: "internal_customer_sense",
          meaningVi: "khách hàng nội bộ",
          category: "business_phrase",
          isSensitive: true,
        });

        const result = await runTransition({ keyPhraseId: "phrase-1" }, {});

        expect(result.userErrorCreated).toBe(true);
        expect(result.mistakePatternStatus).toBe("none");
        expect(repo.userErrors[0].isRepeated).toBe(false);
        expect(repo.userErrors[0].isSourceSensitive).toBe(true);
        expect(repo.mistakePatterns.size).toBe(0);
      });

      it("saves sensitive fallback UserError without long-term MistakePattern memory", async () => {
        const result = await runTransition(
          {
            correctAnswer: "contact john@example.com",
            promptEn: "Please contact john@example.com today.",
          },
          {}
        );

        expect(result.userErrorCreated).toBe(true);
        expect(result.mistakePatternStatus).toBe("none");
        expect(repo.userErrors[0].isRepeated).toBe(false);
        expect(repo.userErrors[0].isSourceSensitive).toBe(true);
        expect(repo.mistakePatterns.size).toBe(0);
      });
    });
  });

  describe("submitReviewAttempt", () => {
    it("returns error state if pattern not found", async () => {
      const result = await engine.submitReviewAttempt({
        userId: "user-1",
        patternId: "pat-nonexistent",
        answer: "hello",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Mistake pattern not found.");
      expect(repo.reviewAttempts.length).toBe(0);
    });

    it("handles correct review answer: increments intervals and triggers prompt generation", async () => {
      // Pre-populate pattern with intervalDays = 1
      const pattern = await repo.upsertMistakePattern({
        userId: "user-1",
        conceptKey: "push_back",
        normalizedPhrase: "push back",
        senseKey: "sense-1",
        category: "phrasal_verb",
        errorType: "phrase_misunderstanding",
        meaningVi: "dời lại / trì hoãn",
        safeReviewPromptVi: "Dịch",
        isSensitive: false,
        intervalDays: 1,
        repetitions: 1,
      });

      grader.result = {
        score: 100,
        isCorrect: true,
        feedbackVi: "Nghĩa đúng!",
      };

      const result = await engine.submitReviewAttempt({
        userId: "user-1",
        patternId: pattern.id,
        answer: "dời lại",
      });

      expect(result.success).toBe(true);
      expect(result.isCorrect).toBe(true);
      expect(repo.reviewAttempts.length).toBe(1);
      expect(repo.reviewAttempts[0].isCorrect).toBe(true);

      const updatedPattern = repo.mistakePatterns.get(pattern.id);
      expect(updatedPattern.intervalDays).toBe(3); // Leitner progression 1 -> 3
      expect(updatedPattern.masteryState).toBe("active");
      expect(updatedPattern.dueAt.getTime()).toBeGreaterThan(Date.now());
      expect(notifyQueueCalls).toBe(1);
    });

    it("constructs mockExercise with the pattern's reviewType and reviewChoices", async () => {
      const pattern = await repo.upsertMistakePattern({
        userId: "user-1",
        conceptKey: "push_back",
        normalizedPhrase: "push back",
        senseKey: "sense-1",
        category: "phrasal_verb",
        errorType: "phrase_misunderstanding",
        meaningVi: "dời lại / trì hoãn",
        safeReviewPromptVi: "Dịch",
        isSensitive: false,
        reviewPromptStatus: "succeeded",
        reviewPromptEn: "Let's push back the meeting.",
        reviewType: "trap_choice",
        reviewChoices: ["choice A", "choice B", "choice C"],
      });

      grader.result = {
        score: 100,
        isCorrect: true,
        feedbackVi: "Chính xác!",
      };

      const result = await engine.submitReviewAttempt({
        userId: "user-1",
        patternId: pattern.id,
        answer: "choice B",
      });

      expect(result.success).toBe(true);
      expect(grader.lastInput).toBeDefined();
      expect(grader.lastInput.exercise.type).toBe("trap_choice");
      expect(grader.lastInput.exercise.choices).toEqual([
        "choice A",
        "choice B",
        "choice C",
      ]);
    });

    it("marks a MistakePattern as mastered when a correct review reaches the final interval", async () => {
      const pattern = await repo.upsertMistakePattern({
        userId: "user-1",
        conceptKey: "push_back",
        normalizedPhrase: "push back",
        senseKey: "sense-1",
        category: "phrasal_verb",
        errorType: "phrase_misunderstanding",
        meaningVi: "dời lại / trì hoãn",
        safeReviewPromptVi: "Dịch",
        isSensitive: false,
        intervalDays: 7,
        repetitions: 3,
        easeFactor: 2.0,
      });

      grader.result = {
        score: 100,
        isCorrect: true,
        feedbackVi: "Nghĩa đúng!",
      };

      const result = await engine.submitReviewAttempt({
        userId: "user-1",
        patternId: pattern.id,
        answer: "dời lại",
      });

      expect(result.success).toBe(true);
      expect(result.masteryState).toBe("mastered");

      const updatedPattern = repo.mistakePatterns.get(pattern.id);
      expect(updatedPattern.intervalDays).toBe(15);
      expect(updatedPattern.masteryState).toBe("mastered");
    });

    it("handles failed review answer: resets interval to 0 and schedules for tomorrow", async () => {
      // Pre-populate pattern with intervalDays = 7
      const pattern = await repo.upsertMistakePattern({
        userId: "user-1",
        conceptKey: "push_back",
        normalizedPhrase: "push back",
        senseKey: "sense-1",
        category: "phrasal_verb",
        errorType: "phrase_misunderstanding",
        meaningVi: "dời lại / trì hoãn",
        safeReviewPromptVi: "Dịch",
        isSensitive: false,
        intervalDays: 7,
      });

      grader.result = {
        score: 0,
        isCorrect: false,
        feedbackVi: "Sai rồi.",
        feedbackDetails: {
          whatWasWrong: "Bạn đã dịch thành đẩy về.",
          whyItWasWrong: "Cụm 'push back' nghĩa là dời lại.",
          correctUnderstanding: "Dời lịch, hoãn lại.",
          mistakeType: "Lỗi cụm động từ",
          nextPracticeItem: "Dịch câu: Let's push back the meeting.",
          detailedExplanation: "Chi tiết...",
        },
      };

      const result = await engine.submitReviewAttempt({
        userId: "user-1",
        patternId: pattern.id,
        answer: "đẩy về",
      });

      expect(result.success).toBe(true);
      expect(result.isCorrect).toBe(false);
      expect(result.feedbackDetails?.mistakeType).toBe("Lỗi cụm động từ");
      expect(result.feedbackDetails?.whatWasWrong).toBe(
        "Bạn đã dịch thành đẩy về."
      );
      expect(repo.reviewAttempts.length).toBe(1);

      const updatedPattern = repo.mistakePatterns.get(pattern.id);
      expect(updatedPattern.intervalDays).toBe(0); // reset to 0
      expect(updatedPattern.masteryState).toBe("active");
      // Check due date is set to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(updatedPattern.dueAt.getDate()).toBe(tomorrow.getDate());
      // Re-generation of review prompt should not be triggered on failed reviews
      expect(notifyQueueCalls).toBe(0);
    });
  });

  describe("generateReviewPrompt", () => {
    it("fetches mistake pattern, calls generator, and saves generated review prompts", async () => {
      const pattern = await repo.upsertMistakePattern({
        userId: "user-1",
        conceptKey: "push_back",
        normalizedPhrase: "push back",
        senseKey: "sense-1",
        category: "phrasal_verb",
        errorType: "phrase_misunderstanding",
        meaningVi: "dời lại / trì hoãn",
        safeReviewPromptVi: "Dịch",
        isSensitive: false,
      });

      await engine.generateReviewPrompt(pattern.id);

      const updatedPattern = repo.mistakePatterns.get(pattern.id);
      expect(updatedPattern.reviewPromptEn).toBe("Mock Prompt En");
      expect(updatedPattern.reviewPromptVi).toBe("Mock Prompt Vi");
      expect(updatedPattern.reviewRubricVi).toBe("Mock Rubric Vi");
      expect(updatedPattern.reviewCorrectAnswer).toBe("Mock Correct Answer");
      expect(updatedPattern.reviewAcceptableAnswers).toContain(
        "Acceptable Answer"
      );
      expect(updatedPattern.reviewPromptStatus).toBe("succeeded");
    });

    it("does nothing if mistake pattern is not found", async () => {
      await engine.generateReviewPrompt("pattern-nonexistent");
      // should not crash or throw
    });
  });

  describe("processNextReviewPromptJob", () => {
    it("processes queued prompt generation jobs successfully", async () => {
      const pattern = await repo.upsertMistakePattern({
        userId: "user-1",
        conceptKey: "push_back",
        normalizedPhrase: "push back",
        senseKey: "sense-1",
        category: "phrasal_verb",
        errorType: "phrase_misunderstanding",
        meaningVi: "dời lại / trì hoãn",
        safeReviewPromptVi: "Dịch",
        isSensitive: false,
      });

      const res = await engine.processNextReviewPromptJob("worker-1");
      expect(res.status).toBe("processed");
      expect((res as any).success).toBe(true);

      const updatedPattern = repo.mistakePatterns.get(pattern.id);
      expect(updatedPattern.reviewPromptStatus).toBe("succeeded");
      expect(updatedPattern.reviewPromptEn).toBe("Mock Prompt En");
    });

    it("handles generator failures by putting jobs back in queue or marking failed", async () => {
      const pattern = await repo.upsertMistakePattern({
        userId: "user-1",
        conceptKey: "push_back",
        normalizedPhrase: "push back",
        senseKey: "sense-1",
        category: "phrasal_verb",
        errorType: "phrase_misunderstanding",
        meaningVi: "dời lại / trì hoãn",
        safeReviewPromptVi: "Dịch",
        isSensitive: false,
      });

      reviewGenerator.error = new Error("Quota exceeded");

      const res = await engine.processNextReviewPromptJob("worker-1");
      expect(res.status).toBe("processed");
      expect((res as any).success).toBe(false);

      const updatedPattern = repo.mistakePatterns.get(pattern.id);
      expect(updatedPattern.reviewPromptStatus).toBe("queued");
      expect(updatedPattern.reviewPromptAttempts).toBe(1);
      expect(updatedPattern.reviewPromptError).toBe("Quota exceeded");
    });
  });
});
