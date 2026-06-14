import { describe, expect, it, beforeEach } from "vitest";
import { DefaultLearnerMemoryEngine } from "./engine";
import { getTextProcessor } from "@/domain/text";
import type { LessonRepository } from "@/domain/lesson/ports";
import type {
  AttemptMemoryTransitionResult,
  AttemptMemoryTransitionInput,
} from "./attempt-memory-transition";
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

class MockDatabaseState {
  exercises = new Map<string, any>();
  mistakePatterns = new Map<string, any>();
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

class MockTransactionCoordinator implements TransactionCoordinator {
  active = false;
  runCount = 0;
  events: string[] = [];

  constructor(
    private exerciseRepo: ExerciseRepository,
    private attemptRepo: AttemptRepository,
    private mistakePatternRepo: MistakePatternRepository
  ) {}

  async runInTransaction<T>(
    operation: (repos: {
      exercises: ExerciseRepository;
      attempts: AttemptRepository;
      mistakePatterns: MistakePatternRepository;
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

class MockJobDispatcher implements JobDispatcher {
  triggered: string[] = [];
  onTrigger?: (patternId: string) => void;

  async triggerReviewPromptGeneration(patternId: string) {
    this.triggered.push(patternId);
    this.onTrigger?.(patternId);
  }
}

class MockAttemptMemoryTransition {
  calls: AttemptMemoryTransitionInput[] = [];
  result: AttemptMemoryTransitionResult = {
    attempt: {
      id: "attempt-1",
      exerciseId: "exercise-1",
      lessonId: "lesson-1",
      userId: "user-1",
      answer: "answer",
      score: 100,
      isCorrect: true,
      feedbackVi: "Chính xác!",
      gradingMetadata: null,
      createdAt: new Date(),
    },
    userErrorCreated: false,
    mistakePatternStatus: "none",
  };
  onApply?: () => void;

  async apply(input: AttemptMemoryTransitionInput) {
    this.calls.push(input);
    this.onApply?.();
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

class MockLessonRepository implements LessonRepository {
  keyPhrases = new Map<string, any>();
  lessonFocuses = new Map<string, any>();

  async findLesson(_lessonId: string, _userId: string): Promise<any> {
    return null;
  }
  async findSourceText(_sourceTextId: string, _userId: string): Promise<any> {
    return null;
  }
  async findLatestLesson(_sourceTextId: string): Promise<any> {
    return null;
  }
  async createSourceTextAndLessonAndJob(
    _userId: string,
    _content: string,
    _title: string,
    _contentHash: string,
    _requestedMode?: string
  ): Promise<any> {
    return null as any;
  }
  async createLessonAndJob(
    _userId: string,
    _sourceTextId: string,
    _version: number,
    _stage: "analysis" | "exercises"
  ): Promise<any> {
    return null as any;
  }
  async createJob(
    _userId: string,
    _sourceTextId: string,
    _lessonId: string,
    _stage: "analysis" | "exercises"
  ): Promise<any> {
    return null as any;
  }
  async claimJob(_workerId: string): Promise<any> {
    return null;
  }
  async updateJobStatus(
    _jobId: string,
    _status: any,
    _extra?: any
  ): Promise<void> {}
  async assertQueueCapacity(_userId: string): Promise<any> {
    return null;
  }
  async updateLessonStatus(
    _lessonId: string,
    _stage: any,
    _status: any,
    _extra?: any
  ): Promise<void> {}
  async saveAnalysis(
    _lessonId: string,
    _userId: string,
    _analysis: any,
    _model: string
  ): Promise<void> {}
  async saveExercises(
    _lessonId: string,
    _userId: string,
    _exercises: any,
    _model: string
  ): Promise<void> {}
  async buildAnalysisFromLesson(_lessonId: string): Promise<any> {
    return null as any;
  }
  async deleteSourceText(
    _userId: string,
    _sourceTextId: string
  ): Promise<void> {}
  async resetStuckJob(_userId: string, _lessonId: string): Promise<void> {}
  async recordMilestone(_input: any): Promise<void> {}
  async recordThought(_input: any): Promise<void> {}
  async getLessonProgress(_input: any): Promise<any> {
    return null;
  }
  async getLessonAggregate(_lessonId: string, _userId: string): Promise<any> {
    return null;
  }
  async getRecentLessons(_userId: string, _limit: number): Promise<any[]> {
    return [];
  }
  async getSourceTextsCount(_userId: string): Promise<number> {
    return 0;
  }

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
  let dispatcher: MockJobDispatcher;
  let reviewGenerator: MockReviewPromptGenerator;
  let attemptTransition: MockAttemptMemoryTransition;
  let engine: DefaultLearnerMemoryEngine;

  beforeEach(() => {
    repo = new MockDatabaseState();
    exerciseRepo = new MockExerciseRepository(repo);
    attemptRepo = new MockAttemptRepository(repo);
    mistakePatternRepo = new MockMistakePatternRepository(repo);
    txCoordinator = new MockTransactionCoordinator(
      exerciseRepo,
      attemptRepo,
      mistakePatternRepo
    );
    lessonRepo = new MockLessonRepository();
    grader = new MockGradingEngine();
    dispatcher = new MockJobDispatcher();
    reviewGenerator = new MockReviewPromptGenerator();
    attemptTransition = new MockAttemptMemoryTransition();
    engine = new DefaultLearnerMemoryEngine(
      exerciseRepo,
      attemptRepo,
      mistakePatternRepo,
      txCoordinator,
      lessonRepo,
      grader,
      dispatcher,
      reviewGenerator,
      getTextProcessor(),
      attemptTransition as any
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
      expect(attemptTransition.calls).toHaveLength(0);
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
      };
      grader.onGrade = () => {
        events.push(txCoordinator.active ? "grade:in-tx" : "grade:outside-tx");
      };
      attemptTransition.onApply = () => {
        events.push(
          txCoordinator.active ? "transition:in-tx" : "transition:outside-tx"
        );
      };
      attemptTransition.result = {
        ...attemptTransition.result,
        userErrorCreated: true,
        mistakePatternStatus: "new",
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
      expect(attemptTransition.calls).toHaveLength(1);
      expect(attemptTransition.calls[0]).toMatchObject({
        userId: "user-1",
        lessonId: "les-1",
        answer: "wrong text",
        exercise: repo.exercises.get("ex-1"),
        grade: grader.result,
      });
      expect(events).toEqual(["grade:outside-tx", "transition:in-tx"]);
      expect(dispatcher.triggered.length).toBe(0);
    });

    it("dispatches the review prompt job only after the transaction completes", async () => {
      repo.exercises.set("ex-1", {
        id: "ex-1",
        userId: "user-1",
        correctAnswer: "correct text",
      });
      const events: string[] = [];
      grader.onGrade = () => {
        events.push("grade");
      };
      attemptTransition.onApply = () => {
        events.push("transition");
      };
      dispatcher.onTrigger = () => {
        events.push(
          txCoordinator.active ? "dispatch:in-tx" : "dispatch:after-tx"
        );
      };
      attemptTransition.result = {
        ...attemptTransition.result,
        reviewPromptJob: { patternId: "pattern-42" },
      };

      await engine.submitAttempt({
        userId: "user-1",
        exerciseId: "ex-1",
        lessonId: "les-1",
        answer: "wrong text",
      });

      expect(dispatcher.triggered).toEqual(["pattern-42"]);
      expect(events).toEqual(["grade", "transition", "dispatch:after-tx"]);
      expect(txCoordinator.events).toEqual(["tx:start", "tx:end"]);
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
      expect(dispatcher.triggered).toContain(pattern.id);
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
      expect(dispatcher.triggered).not.toContain(pattern.id);
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
