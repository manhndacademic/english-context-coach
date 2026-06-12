import { describe, expect, it, beforeEach } from "vitest";
import { DefaultLearnerMemoryEngine } from "./engine";
import { getTextProcessor } from "@/domain/text";
import type { LearnerMemoryRepository, GradingEngine, JobDispatcher, ReviewPromptGenerator } from "./ports";

class MockLearnerMemoryRepository implements LearnerMemoryRepository {
  exercises = new Map<string, any>();
  mistakePatterns = new Map<string, any>();
  keyPhrases = new Map<string, any>();
  lessonFocuses = new Map<string, any>();

  attempts: any[] = [];
  userErrors: any[] = [];
  reviewAttempts: any[] = [];

  async findExercise(exerciseId: string, userId: string) {
    const exercise = this.exercises.get(exerciseId);
    if (exercise && exercise.userId === userId) return exercise;
    return null;
  }

  async findMistakePattern(patternId: string, userId: string) {
    const pattern = this.mistakePatterns.get(patternId);
    if (pattern && pattern.userId === userId) return pattern;
    return null;
  }

  async findPatternByConcept(userId: string, conceptKey: string, errorType: string) {
    for (const pattern of this.mistakePatterns.values()) {
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

  async findKeyPhrase(keyPhraseId: string) {
    return this.keyPhrases.get(keyPhraseId) ?? null;
  }

  async findLessonFocus(lessonFocusId: string) {
    return this.lessonFocuses.get(lessonFocusId) ?? null;
  }

  async runInTransaction<T>(operation: (tx: LearnerMemoryRepository) => Promise<T>): Promise<T> {
    return await operation(this);
  }

  async createAttempt(attempt: any) {
    const created = { id: `attempt-${this.attempts.length + 1}`, createdAt: new Date(), ...attempt };
    this.attempts.push(created);
    return created;
  }

  async createUserError(error: any) {
    const created = { id: `user-error-${this.userErrors.length + 1}`, createdAt: new Date(), ...error };
    this.userErrors.push(created);
    return created;
  }

  async upsertMistakePattern(input: any) {
    const existing = await this.findPatternByConcept(input.userId, input.conceptKey, input.errorType);
    if (existing) {
      existing.occurrenceCount += 1;
      existing.updatedAt = new Date();
      return existing;
    }
    const created = {
      id: `pattern-${this.mistakePatterns.size + 1}`,
      occurrenceCount: 1,
      intervalDays: 0,
      dueAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      reviewPromptEn: null,
      ...input,
    };
    this.mistakePatterns.set(created.id, created);
    return created;
  }

  async updateMistakePatternSchedule(patternId: string, updates: any) {
    const pattern = this.mistakePatterns.get(patternId);
    if (pattern) {
      pattern.intervalDays = updates.intervalDays;
      pattern.dueAt = updates.dueAt;
      pattern.lastReviewedAt = updates.lastReviewedAt ?? pattern.lastReviewedAt;
      pattern.updatedAt = new Date();
    }
  }

  async createReviewAttempt(attempt: any) {
    const created = { id: `review-attempt-${this.reviewAttempts.length + 1}`, createdAt: new Date(), ...attempt };
    this.reviewAttempts.push(created);
    return created;
  }

  async findDueMistakePatterns(userId: string, dueAt: Date, limit: number): Promise<any[]> {
    return [];
  }

  async getDashboardMetrics(userId: string, dueAt: Date): Promise<any> {
    return {
      dueCount: 0,
      patternCount: 0,
      repeatedMistakes: [],
    };
  }

  async findMistakePatternById(patternId: string): Promise<any> {
    return this.mistakePatterns.get(patternId) ?? null;
  }

  async updateMistakePatternReviewPrompt(patternId: string, prompts: any): Promise<void> {
    const pattern = this.mistakePatterns.get(patternId);
    if (pattern) {
      Object.assign(pattern, prompts);
    }
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

  async generate(input: any) {
    return this.result;
  }
}

describe("LearnerMemoryEngine Domain Orchestrator", () => {
  let repo: MockLearnerMemoryRepository;
  let grader: MockGradingEngine;
  let dispatcher: MockJobDispatcher;
  let reviewGenerator: MockReviewPromptGenerator;
  let engine: DefaultLearnerMemoryEngine;

  beforeEach(() => {
    repo = new MockLearnerMemoryRepository();
    grader = new MockGradingEngine();
    dispatcher = new MockJobDispatcher();
    reviewGenerator = new MockReviewPromptGenerator();
    engine = new DefaultLearnerMemoryEngine(repo, grader, dispatcher, reviewGenerator, getTextProcessor());
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

      repo.keyPhrases.set("phrase-1", {
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

      expect(dispatcher.triggered).toContain(pattern.id);
    });

    it("detects repeated mistakes, increments occurrence count, and sets repeated flag", async () => {
      repo.exercises.set("ex-1", {
        id: "ex-1",
        userId: "user-1",
        correctAnswer: "push this back",
        keyPhraseId: "phrase-1",
      });

      repo.keyPhrases.set("phrase-1", {
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
      // If it already exists and has no en prompt, it triggers, but here we mock isRepeated and reviewPromptEn.
      // Since reviewPromptEn is null on our pre-populated mock pattern, it will still trigger prompt generation
      expect(dispatcher.triggered).toContain(pattern.id);
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
      });
      pattern.intervalDays = 1;

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
      expect(updatedPattern.dueAt.getTime()).toBeGreaterThan(Date.now());
      expect(dispatcher.triggered).toContain(pattern.id);
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
      });
      pattern.intervalDays = 7;

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
    });

    it("does nothing if mistake pattern is not found", async () => {
      await engine.generateReviewPrompt("pattern-nonexistent");
      // should not crash or throw
    });
  });
});
