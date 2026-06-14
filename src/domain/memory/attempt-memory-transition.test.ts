import { describe, expect, it, beforeEach } from "vitest";
import type { LessonRepository, Exercise } from "@/domain/lesson/ports";
import { getTextProcessor } from "@/domain/text";
import {
  AttemptMemoryTransition,
  MIN_USER_ERROR_CONFIDENCE,
} from "./attempt-memory-transition";
import { MistakePattern } from "./mistake-pattern";
import type {
  AttemptRepository,
  LearnerGradingResult,
  MistakePatternRepository,
} from "./ports";

class MockAttemptRepository implements AttemptRepository {
  attempts: any[] = [];
  userErrors: any[] = [];

  async createAttempt(attempt: any) {
    const created = {
      id: `attempt-${this.attempts.length + 1}`,
      createdAt: new Date(),
      ...attempt,
    };
    this.attempts.push(created);
    return created;
  }

  async createReviewAttempt(attempt: any) {
    return {
      id: "review-attempt-1",
      createdAt: new Date(),
      ...attempt,
    };
  }

  async createUserError(error: any) {
    const created = {
      id: `user-error-${this.userErrors.length + 1}`,
      createdAt: new Date(),
      ...error,
    };
    this.userErrors.push(created);
    return created;
  }
}

class MockMistakePatternRepository implements MistakePatternRepository {
  patterns = new Map<string, MistakePattern>();
  upsertCalls = 0;
  saveCalls = 0;

  async findMistakePattern(patternId: string, userId: string) {
    const pattern = this.patterns.get(patternId);
    return pattern?.userId === userId ? pattern : null;
  }

  async findMistakePatternById(patternId: string) {
    return this.patterns.get(patternId) ?? null;
  }

  async findPatternByConcept(
    userId: string,
    conceptKey: string,
    errorType: string
  ) {
    return (
      Array.from(this.patterns.values()).find(
        (pattern) =>
          pattern.userId === userId &&
          pattern.conceptKey === conceptKey &&
          pattern.errorType === errorType
      ) ?? null
    );
  }

  async upsertMistakePattern(pattern: MistakePattern) {
    this.upsertCalls += 1;
    this.patterns.set(pattern.id, pattern);
    return pattern;
  }

  async saveMistakePattern(pattern: MistakePattern) {
    this.saveCalls += 1;
    this.patterns.set(pattern.id, pattern);
  }

  async claimReviewPromptJob() {
    return null;
  }

  async findDueMistakePatterns() {
    return [];
  }

  async getDashboardMetrics() {
    return {
      dueCount: 0,
      patternCount: 0,
      repeatedMistakes: [],
      learningStreakDays: 0,
      masteredCount: 0,
      reviewSuccessRate: 0,
      masteredTrend: [],
    };
  }
}

class MockLessonRepository {
  keyPhrases = new Map<string, any>();
  lessonFocuses = new Map<string, any>();

  async findKeyPhrase(id: string) {
    return this.keyPhrases.get(id) ?? null;
  }

  async findLessonFocus(id: string) {
    return this.lessonFocuses.get(id) ?? null;
  }
}

const baseExercise = (overrides: Partial<Exercise> = {}): Exercise =>
  ({
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
    ...overrides,
  }) as Exercise;

const wrongGrade = (
  overrides: Partial<LearnerGradingResult> = {}
): LearnerGradingResult => ({
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
  ...overrides,
});

describe("AttemptMemoryTransition", () => {
  let attempts: MockAttemptRepository;
  let patterns: MockMistakePatternRepository;
  let lessons: MockLessonRepository;
  let transition: AttemptMemoryTransition;

  beforeEach(() => {
    attempts = new MockAttemptRepository();
    patterns = new MockMistakePatternRepository();
    lessons = new MockLessonRepository();
    transition = new AttemptMemoryTransition(
      lessons as unknown as LessonRepository,
      getTextProcessor(),
      () => `pattern-${patterns.patterns.size + 1}`
    );
  });

  it("exposes the memory confidence gate as a domain constant", () => {
    expect(MIN_USER_ERROR_CONFIDENCE).toBe(70);
  });

  it("saves an attempt without user memory when shouldSave is false", async () => {
    const result = await transition.apply(
      {
        userId: "user-1",
        lessonId: "lesson-1",
        exercise: baseExercise(),
        answer: "wrong",
        grade: wrongGrade({
          error: {
            shouldSave: false,
            confidence: 100,
            errorType: "phrase_misunderstanding",
            explanationVi: "Không nên lưu.",
            targetItem: "push back",
          },
        }),
      },
      { attempts, mistakePatterns: patterns }
    );

    expect(result.userErrorCreated).toBe(false);
    expect(result.mistakePatternStatus).toBe("none");
    expect(attempts.attempts).toHaveLength(1);
    expect(attempts.userErrors).toHaveLength(0);
    expect(patterns.patterns.size).toBe(0);
  });

  it("saves an attempt without user memory when confidence is below the gate", async () => {
    const result = await transition.apply(
      {
        userId: "user-1",
        lessonId: "lesson-1",
        exercise: baseExercise(),
        answer: "wrong",
        grade: wrongGrade({
          error: {
            shouldSave: true,
            confidence: MIN_USER_ERROR_CONFIDENCE - 1,
            errorType: "phrase_misunderstanding",
            explanationVi: "Không đủ chắc.",
            targetItem: "push back",
          },
        }),
      },
      { attempts, mistakePatterns: patterns }
    );

    expect(result.userErrorCreated).toBe(false);
    expect(attempts.attempts).toHaveLength(1);
    expect(attempts.userErrors).toHaveLength(0);
  });

  it("uses KeyPhrase concept as authoritative over AI targetItem", async () => {
    lessons.keyPhrases.set("phrase-1", {
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

    await transition.apply(
      {
        userId: "user-1",
        lessonId: "lesson-1",
        exercise: baseExercise({ keyPhraseId: "phrase-1" }),
        answer: "wrong",
        grade: wrongGrade(),
      },
      { attempts, mistakePatterns: patterns }
    );

    expect(attempts.userErrors[0].conceptKey).toBe("push_back");
    expect(attempts.userErrors[0].normalizedPhrase).toBe("push back");
    expect(Array.from(patterns.patterns.values())[0].meaningVi).toBe(
      "dời lại / trì hoãn"
    );
  });

  it("uses LessonFocus concept when there is no KeyPhrase", async () => {
    lessons.lessonFocuses.set("focus-1", {
      id: "focus-1",
      title: "Lời nhờ lịch sự",
      conceptKey: "polite_request",
      conceptPhrase: "polite request",
      conceptMeaningVi: "nhờ vả lịch sự, không gây áp lực",
      category: "tone",
      explanationVi: "Dùng sắc thái mềm.",
    });

    await transition.apply(
      {
        userId: "user-1",
        lessonId: "lesson-1",
        exercise: baseExercise({ lessonFocusId: "focus-1" }),
        answer: "wrong",
        grade: wrongGrade(),
      },
      { attempts, mistakePatterns: patterns }
    );

    const pattern = Array.from(patterns.patterns.values())[0];
    expect(attempts.userErrors[0].conceptKey).toBe("polite_request");
    expect(pattern.normalizedPhrase).toBe("polite request");
    expect(pattern.category).toBe("business_phrase");
  });

  it("uses exercise fallback before AI targetItem when no concept owner exists", async () => {
    await transition.apply(
      {
        userId: "user-1",
        lessonId: "lesson-1",
        exercise: baseExercise({
          correctAnswer: "dời việc này lại",
          promptEn: "Could you push this back?",
        }),
        answer: "wrong",
        grade: wrongGrade(),
      },
      { attempts, mistakePatterns: patterns }
    );

    expect(attempts.userErrors[0].conceptKey).toBe("dời việc này lại");
    expect(attempts.userErrors[0].conceptKey).not.toBe(
      "ai target should not win"
    );
  });

  it("creates a new MistakePattern and returns a review prompt job", async () => {
    const result = await transition.apply(
      {
        userId: "user-1",
        lessonId: "lesson-1",
        exercise: baseExercise(),
        answer: "wrong",
        grade: wrongGrade(),
      },
      { attempts, mistakePatterns: patterns }
    );

    expect(result.userErrorCreated).toBe(true);
    expect(result.mistakePatternStatus).toBe("new");
    expect(result.reviewPromptJob).toEqual({ patternId: "pattern-1" });
    expect(patterns.upsertCalls).toBe(1);
    expect(patterns.saveCalls).toBe(0);
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
    patterns.patterns.set(existing.id, existing);

    const result = await transition.apply(
      {
        userId: "user-1",
        lessonId: "lesson-1",
        exercise: baseExercise(),
        answer: "wrong again",
        grade: wrongGrade(),
      },
      { attempts, mistakePatterns: patterns }
    );

    expect(result.mistakePatternStatus).toBe("repeated");
    expect(attempts.userErrors[0].isRepeated).toBe(true);
    expect(existing.occurrenceCount).toBe(2);
    expect(existing.intervalDays).toBe(0);
    expect(patterns.upsertCalls).toBe(0);
    expect(patterns.saveCalls).toBe(1);
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
    patterns.patterns.set(mastered.id, mastered);

    await transition.apply(
      {
        userId: "user-1",
        lessonId: "lesson-1",
        exercise: baseExercise(),
        answer: "wrong again",
        grade: wrongGrade(),
      },
      { attempts, mistakePatterns: patterns }
    );

    expect(mastered.occurrenceCount).toBe(4);
    expect(mastered.intervalDays).toBe(0);
    expect(mastered.masteryState).toBe("active");
    expect(mastered.dueAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("saves sensitive KeyPhrase UserError without long-term MistakePattern memory", async () => {
    lessons.keyPhrases.set("phrase-1", {
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

    const result = await transition.apply(
      {
        userId: "user-1",
        lessonId: "lesson-1",
        exercise: baseExercise({ keyPhraseId: "phrase-1" }),
        answer: "wrong",
        grade: wrongGrade(),
      },
      { attempts, mistakePatterns: patterns }
    );

    expect(result.userErrorCreated).toBe(true);
    expect(result.mistakePatternStatus).toBe("none");
    expect(result.reviewPromptJob).toBeUndefined();
    expect(attempts.userErrors[0].isRepeated).toBe(false);
    expect(attempts.userErrors[0].isSourceSensitive).toBe(true);
    expect(patterns.patterns.size).toBe(0);
  });

  it("saves sensitive fallback UserError without long-term MistakePattern memory", async () => {
    const result = await transition.apply(
      {
        userId: "user-1",
        lessonId: "lesson-1",
        exercise: baseExercise({
          correctAnswer: "contact john@example.com",
          promptEn: "Please contact john@example.com today.",
        }),
        answer: "wrong",
        grade: wrongGrade(),
      },
      { attempts, mistakePatterns: patterns }
    );

    expect(result.userErrorCreated).toBe(true);
    expect(result.mistakePatternStatus).toBe("none");
    expect(result.reviewPromptJob).toBeUndefined();
    expect(attempts.userErrors[0].isRepeated).toBe(false);
    expect(attempts.userErrors[0].isSourceSensitive).toBe(true);
    expect(patterns.patterns.size).toBe(0);
  });
});
