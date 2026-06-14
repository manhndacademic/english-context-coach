import { describe, expect, it, beforeEach } from "vitest";
import { DefaultLearnerMemoryEngine } from "./engine";
import { getTextProcessor } from "@/domain/text";
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

class MockDatabaseState {
  exercises = new Map<string, any>();
  mistakePatterns = new Map<string, any>();
  attempts: any[] = [];
  userErrors: any[] = [];
  reviewAttempts: any[] = [];

  async upsertMistakePattern(input: any) {
    const existing = Array.from(this.mistakePatterns.values()).find(
      (p) => p.userId === input.userId && p.conceptKey === input.conceptKey && p.errorType === input.errorType
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
    if (input.reviewPromptStatus || input.intervalDays || input.masteryState || input.reviewPromptEn) {
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
    const created = { id: `attempt-${this.state.attempts.length + 1}`, createdAt: new Date(), ...attempt };
    this.state.attempts.push(created);
    return created;
  }

  async createReviewAttempt(attempt: any) {
    const created = { id: `review-attempt-${this.state.reviewAttempts.length + 1}`, createdAt: new Date(), ...attempt };
    this.state.reviewAttempts.push(created);
    return created;
  }

  async createUserError(error: any) {
    const created = { id: `user-error-${this.state.userErrors.length + 1}`, createdAt: new Date(), ...error };
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

  async findPatternByConcept(userId: string, conceptKey: string, errorType: string) {
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
          pattern.dueAt <= dueAt,
      )
      .slice(0, limit);
  }

  async getDashboardMetrics(userId: string, dueAt: Date) {
    return {
      dueCount: 0,
      patternCount: 0,
      repeatedMistakes: [],
    };
  }
}

class MockTransactionCoordinator implements TransactionCoordinator {
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
    return await operation({
      exercises: this.exerciseRepo,
      attempts: this.attemptRepo,
      mistakePatterns: this.mistakePatternRepo,
    });
  }
}

class MockGradingEngine implements GradingEngine {
  result: any = {
    score: 100,
    isCorrect: true,
    feedbackVi: "Chính xác!",
  };

  async grade() {
    return this.result;
  }
}

class MockJobDispatcher implements JobDispatcher {
  triggered: string[] = [];

  async triggerReviewPromptGeneration(patternId: string) {
    this.triggered.push(patternId);
  }
}

class MockReviewPromptGenerator implements ReviewPromptGenerator {
  result = {
    reviewPromptEn: "Mock Prompt En",
    reviewPromptVi: "Mock Prompt Vi",
    reviewRubricVi: "Mock Rubric Vi",
    reviewCorrectAnswer: "Mock Correct Answer",
    reviewAcceptableAnswers: ["Acceptable Answer"],
  };
  error: Error | null = null;

  async generate(input: any) {
    if (this.error) throw this.error;
    return this.result;
  }
}

class MockLessonRepository implements LessonRepository {
  keyPhrases = new Map<string, any>();
  lessonFocuses = new Map<string, any>();

  async findLesson(lessonId: string, userId: string): Promise<any> { return null; }
  async findSourceText(sourceTextId: string, userId: string): Promise<any> { return null; }
  async findLatestLesson(sourceTextId: string): Promise<any> { return null; }
  async createSourceTextAndLessonAndJob(userId: string, content: string, title: string, contentHash: string, requestedMode?: string): Promise<any> { return null as any; }
  async createLessonAndJob(userId: string, sourceTextId: string, version: number, stage: "analysis" | "exercises"): Promise<any> { return null as any; }
  async createJob(userId: string, sourceTextId: string, lessonId: string, stage: "analysis" | "exercises"): Promise<any> { return null as any; }
  async claimJob(workerId: string): Promise<any> { return null; }
  async updateJobStatus(jobId: string, status: any, extra?: any): Promise<void> {}
  async assertQueueCapacity(userId: string): Promise<any> { return null; }
  async updateLessonStatus(lessonId: string, stage: any, status: any, extra?: any): Promise<void> {}
  async saveAnalysis(lessonId: string, userId: string, analysis: any, model: string): Promise<void> {}
  async saveExercises(lessonId: string, userId: string, exercises: any, model: string): Promise<void> {}
  async buildAnalysisFromLesson(lessonId: string): Promise<any> { return null as any; }
  async deleteSourceText(userId: string, sourceTextId: string): Promise<void> {}
  async resetStuckJob(userId: string, lessonId: string): Promise<void> {}
  async recordMilestone(input: any): Promise<void> {}
  async recordThought(input: any): Promise<void> {}
  async getLessonProgress(input: any): Promise<any> { return null; }
  async getLessonAggregate(lessonId: string, userId: string): Promise<any> { return null; }
  async getRecentLessons(userId: string, limit: number): Promise<any[]> { return []; }
  async getSourceTextsCount(userId: string): Promise<number> { return 0; }

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
  let engine: DefaultLearnerMemoryEngine;

  beforeEach(() => {
    repo = new MockDatabaseState();
    exerciseRepo = new MockExerciseRepository(repo);
    attemptRepo = new MockAttemptRepository(repo);
    mistakePatternRepo = new MockMistakePatternRepository(repo);
    txCoordinator = new MockTransactionCoordinator(exerciseRepo, attemptRepo, mistakePatternRepo);
    lessonRepo = new MockLessonRepository();
    grader = new MockGradingEngine();
    dispatcher = new MockJobDispatcher();
    reviewGenerator = new MockReviewPromptGenerator();
    engine = new DefaultLearnerMemoryEngine(
      exerciseRepo,
      attemptRepo,
      mistakePatternRepo,
      txCoordinator,
      lessonRepo,
      grader,
      dispatcher,
      reviewGenerator,
      getTextProcessor()
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

    it("persists correct attempt and returns success without creating userErrors", async () => {
      repo.exercises.set("ex-1", {
        id: "ex-1",
        userId: "user-1",
        correctAnswer: "correct text",
      });

      const result = await engine.submitAttempt({
        userId: "user-1",
        exerciseId: "ex-1",
        lessonId: "les-1",
        answer: "correct text",
      });

      expect(result.success).toBe(true);
      expect(result.isCorrect).toBe(true);
      expect(result.score).toBe(100);
      expect(repo.attempts.length).toBe(1);
      expect(repo.attempts[0].isCorrect).toBe(true);
      expect(repo.userErrors.length).toBe(0);
      expect(repo.mistakePatterns.size).toBe(0);
      expect(dispatcher.triggered.length).toBe(0);
    });

    it("persists incorrect attempt, creates userError, creates mistakePattern, and triggers background prompt job", async () => {
      repo.exercises.set("ex-1", {
        id: "ex-1",
        userId: "user-1",
        correctAnswer: "push this back",
        keyPhraseId: "phrase-1",
      });

      lessonRepo.keyPhrases.set("phrase-1", {
        id: "phrase-1",
        normalizedPhrase: "push back",
        conceptKey: "push_back",
        conceptPhrase: "push back",
        conceptMeaningVi: "dời lại / trì hoãn",
        isSensitive: false,
      });

      grader.result = {
        score: 0,
        isCorrect: false,
        feedbackVi: "Chưa đúng, 'push this back' nghĩa là dời lại.",
        error: {
          shouldSave: true,
          confidence: 90,
          errorType: "phrase_misunderstanding",
          explanationVi: "Sai cụm push back",
          targetItem: "push this back",
        },
      };

      const result = await engine.submitAttempt({
        userId: "user-1",
        exerciseId: "ex-1",
        lessonId: "les-1",
        answer: "đẩy nó về sau",
      });

      expect(result.success).toBe(true);
      expect(result.isCorrect).toBe(false);
      expect(repo.attempts.length).toBe(1);
      expect(repo.userErrors.length).toBe(1);
      expect(repo.userErrors[0].isRepeated).toBe(false);
      expect(repo.userErrors[0].conceptKey).toBe("push_back");

      expect(repo.mistakePatterns.size).toBe(1);
      const pattern = Array.from(repo.mistakePatterns.values())[0];
      expect(pattern.conceptKey).toBe("push_back");
      expect(pattern.occurrenceCount).toBe(1);
      expect(pattern.masteryState).toBe("active");

      expect(dispatcher.triggered).toContain(pattern.id);
    });

    it("detects repeated mistakes, increments occurrence count, and sets repeated flag", async () => {
      repo.exercises.set("ex-1", {
        id: "ex-1",
        userId: "user-1",
        correctAnswer: "push this back",
        keyPhraseId: "phrase-1",
      });

      lessonRepo.keyPhrases.set("phrase-1", {
        id: "phrase-1",
        normalizedPhrase: "push back",
        conceptKey: "push_back",
        conceptPhrase: "push back",
        conceptMeaningVi: "dời lại / trì hoãn",
        isSensitive: false,
      });

      // Pre-populate mistake pattern
      await repo.upsertMistakePattern({
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

      grader.result = {
        score: 0,
        isCorrect: false,
        feedbackVi: "Lại sai rồi.",
        error: {
          shouldSave: true,
          confidence: 95,
          errorType: "phrase_misunderstanding",
          explanationVi: "Lặp lại lỗi push back",
          targetItem: "push this back",
        },
      };

      const result = await engine.submitAttempt({
        userId: "user-1",
        exerciseId: "ex-1",
        lessonId: "les-1",
        answer: "đẩy nó về",
      });

      expect(result.success).toBe(true);
      expect(repo.userErrors.length).toBe(1);
      expect(repo.userErrors[0].isRepeated).toBe(true);

      const pattern = Array.from(repo.mistakePatterns.values())[0];
      expect(pattern.occurrenceCount).toBe(2);
      expect(pattern.masteryState).toBe("active");
      // If it already exists and has no en prompt, it triggers, but here we mock isRepeated and reviewPromptEn.
      // Since reviewPromptEn is null on our pre-populated mock pattern, it will still trigger prompt generation
      expect(dispatcher.triggered).toContain(pattern.id);
    });

    it("reactivates a mastered MistakePattern when the learner repeats the same UserError", async () => {
      repo.exercises.set("ex-1", {
        id: "ex-1",
        userId: "user-1",
        correctAnswer: "push this back",
        keyPhraseId: "phrase-1",
      });

      lessonRepo.keyPhrases.set("phrase-1", {
        id: "phrase-1",
        normalizedPhrase: "push back",
        conceptKey: "push_back",
        conceptPhrase: "push back",
        conceptMeaningVi: "dời lại / trì hoãn",
        isSensitive: false,
      });

      const masteredPattern = await repo.upsertMistakePattern({
        userId: "user-1",
        conceptKey: "push_back",
        normalizedPhrase: "push back",
        senseKey: "sense-1",
        category: "phrasal_verb",
        errorType: "phrase_misunderstanding",
        meaningVi: "dời lại / trì hoãn",
        safeReviewPromptVi: "Dịch",
        isSensitive: false,
        masteryState: "mastered",
        intervalDays: 14,
      });

      grader.result = {
        score: 0,
        isCorrect: false,
        feedbackVi: "Lại sai rồi.",
        error: {
          shouldSave: true,
          confidence: 95,
          errorType: "phrase_misunderstanding",
          explanationVi: "Lặp lại lỗi push back",
          targetItem: "push this back",
        },
      };

      const result = await engine.submitAttempt({
        userId: "user-1",
        exerciseId: "ex-1",
        lessonId: "les-1",
        answer: "đẩy nó về",
      });

      expect(result.success).toBe(true);
      expect(repo.userErrors[0].isRepeated).toBe(true);
      expect(masteredPattern.occurrenceCount).toBe(2);
      expect(masteredPattern.intervalDays).toBe(0);
      expect(masteredPattern.masteryState).toBe("active");
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
      expect(updatedPattern.intervalDays).toBe(14);
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
      };

      const result = await engine.submitReviewAttempt({
        userId: "user-1",
        patternId: pattern.id,
        answer: "đẩy về",
      });

      expect(result.success).toBe(true);
      expect(result.isCorrect).toBe(false);
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
      expect(updatedPattern.reviewAcceptableAnswers).toContain("Acceptable Answer");
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
