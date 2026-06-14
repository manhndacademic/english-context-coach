import { describe, expect, it } from "vitest";
import { MistakePattern } from "./mistake-pattern";

describe("MistakePattern Domain Aggregate (SM-2)", () => {
  it("should create new mistake patterns with correct default SM-2 state", () => {
    const pattern = MistakePattern.createNew({
      id: "pattern-1",
      userId: "user-123",
      conceptKey: "push_back",
      normalizedPhrase: "push back",
      senseKey: "sense-123",
      category: "phrasal_verb",
      errorType: "phrase_misunderstanding",
      meaningVi: "hoãn lại",
      safeReviewPromptVi: "Dịch câu sau: ...",
      isSensitive: false,
    });

    expect(pattern.occurrenceCount).toBe(1);
    expect(pattern.intervalDays).toBe(0);
    expect(pattern.easeFactor).toBe(2.5);
    expect(pattern.repetitions).toBe(0);
    expect(pattern.masteryState).toBe("active");
    expect(pattern.reviewPromptStatus).toBe("queued");
    expect(pattern.dueAt).toBeInstanceOf(Date);
  });

  it("should check isDue correctly based on state and status", () => {
    const now = new Date();
    const pattern = MistakePattern.createNew({
      id: "pattern-1",
      userId: "user-123",
      conceptKey: "push_back",
      normalizedPhrase: "push back",
      senseKey: "sense-123",
      category: "phrasal_verb",
      errorType: "phrase_misunderstanding",
      meaningVi: "hoãn lại",
      safeReviewPromptVi: "Dịch câu sau: ...",
      isSensitive: false,
    });

    // Fresh pattern has reviewPromptStatus = "queued", so isDue should be false
    expect(pattern.isDue(now)).toBe(false);

    // Set to succeeded and due now
    pattern.updateReviewPrompt({
      reviewPromptEn: "Let's push back the meeting.",
      reviewPromptVi: "Hãy hoãn cuộc họp lại.",
      reviewRubricVi: "Phải dịch đúng push back.",
      reviewCorrectAnswer: "Hãy hoãn cuộc họp lại.",
      reviewAcceptableAnswers: ["Hãy dời cuộc họp lại."],
    });

    expect(pattern.reviewPromptStatus).toBe("succeeded");
    expect(pattern.isDue(now)).toBe(true);

    // If check time is in the past, it should not be due
    const past = new Date(Date.now() - 100000);
    expect(pattern.isDue(past)).toBe(false);
  });

  it("should increment occurrence correctly and reset repetitions and interval", () => {
    const pattern = MistakePattern.createNew({
      id: "pattern-1",
      userId: "user-123",
      conceptKey: "push_back",
      normalizedPhrase: "push back",
      senseKey: "sense-123",
      category: "phrasal_verb",
      errorType: "phrase_misunderstanding",
      meaningVi: "hoãn lại",
      safeReviewPromptVi: "Dịch câu sau: ...",
      isSensitive: false,
    });

    // Make it progress (reps = 2, interval = 3)
    pattern.recordReviewAttempt(true, undefined, new Date());
    pattern.recordReviewAttempt(true, undefined, new Date());
    expect(pattern.repetitions).toBe(2);
    expect(pattern.intervalDays).toBe(3);

    // Re-encountering the mistake in lesson resets reps and interval
    pattern.incrementOccurrence();
    expect(pattern.occurrenceCount).toBe(2);
    expect(pattern.intervalDays).toBe(0);
    expect(pattern.repetitions).toBe(0);
    expect(pattern.masteryState).toBe("active");
  });

  describe("SM-2 scheduling calculations", () => {
    it("progresses intervals and adjusts Ease Factor correctly with perfect rating (q=5)", () => {
      const start = new Date("2026-06-14T12:00:00Z");
      const pattern = MistakePattern.createNew({
        id: "pattern-1",
        userId: "user-123",
        conceptKey: "push_back",
        normalizedPhrase: "push back",
        senseKey: "sense-123",
        category: "phrasal_verb",
        errorType: "phrase_misunderstanding",
        meaningVi: "hoãn lại",
        safeReviewPromptVi: "Dịch câu sau: ...",
        isSensitive: false,
      });

      // 1st success (score 98 -> q=5)
      pattern.recordReviewAttempt(true, 98, start);
      expect(pattern.repetitions).toBe(1);
      expect(pattern.intervalDays).toBe(1);
      // EF = 2.5 + (0.1 - (0) * ...) = 2.6
      expect(pattern.easeFactor).toBeCloseTo(2.6, 2);
      expect(pattern.dueAt.getUTCDate()).toBe(15);

      // 2nd success (score 100 -> q=5)
      pattern.recordReviewAttempt(true, 100, start);
      expect(pattern.repetitions).toBe(2);
      expect(pattern.intervalDays).toBe(3); // custom interval for n=2
      // EF = 2.6 + 0.1 = 2.7
      expect(pattern.easeFactor).toBeCloseTo(2.7, 2);
      expect(pattern.dueAt.getUTCDate()).toBe(17);

      // 3rd success (score 95 -> q=5)
      pattern.recordReviewAttempt(true, 95, start);
      expect(pattern.repetitions).toBe(3);
      // interval = Math.round(3 * 2.7) = 8
      expect(pattern.intervalDays).toBe(8);
      // EF = 2.7 + 0.1 = 2.8
      expect(pattern.easeFactor).toBeCloseTo(2.8, 2);
      expect(pattern.dueAt.getUTCDate()).toBe(22);

      // 4th success (score 96 -> q=5) -> interval = Math.round(8 * 2.9) = 23
      pattern.recordReviewAttempt(true, 96, start);
      expect(pattern.intervalDays).toBe(23);
      expect(pattern.masteryState).toBe("mastered"); // interval >= 14 -> mastered
    });

    it("lowers Ease Factor when review is recalled with difficulty (q=3)", () => {
      const start = new Date("2026-06-14T12:00:00Z");
      const pattern = MistakePattern.createNew({
        id: "pattern-1",
        userId: "user-123",
        conceptKey: "push_back",
        normalizedPhrase: "push back",
        senseKey: "sense-123",
        category: "phrasal_verb",
        errorType: "phrase_misunderstanding",
        meaningVi: "hoãn lại",
        safeReviewPromptVi: "Dịch câu sau: ...",
        isSensitive: false,
      });

      // 1st success recalled with difficulty (score 75 -> q=3)
      pattern.recordReviewAttempt(true, 75, start);
      expect(pattern.repetitions).toBe(1);
      expect(pattern.intervalDays).toBe(1);
      // EF' = 2.5 + (0.1 - (2) * (0.08 + 2 * 0.02)) = 2.5 + (0.1 - 2 * 0.12) = 2.5 - 0.14 = 2.36
      expect(pattern.easeFactor).toBeCloseTo(2.36, 2);
    });

    it("resets repetitions to 0 and interval to 0 upon failure (q < 3)", () => {
      const start = new Date("2026-06-14T12:00:00Z");
      const pattern = MistakePattern.createNew({
        id: "pattern-1",
        userId: "user-123",
        conceptKey: "push_back",
        normalizedPhrase: "push back",
        senseKey: "sense-123",
        category: "phrasal_verb",
        errorType: "phrase_misunderstanding",
        meaningVi: "hoãn lại",
        safeReviewPromptVi: "Dịch câu sau: ...",
        isSensitive: false,
      });

      // Success
      pattern.recordReviewAttempt(true, 95, start);
      expect(pattern.repetitions).toBe(1);
      expect(pattern.intervalDays).toBe(1);

      // Failure (score 40 -> q=1)
      pattern.recordReviewAttempt(false, 40, start);
      expect(pattern.repetitions).toBe(0);
      expect(pattern.intervalDays).toBe(0);
      expect(pattern.dueAt.getUTCDate()).toBe(15); // due tomorrow
      // EF' = 2.6 + (0.1 - 4 * (0.08 + 4 * 0.02)) = 2.6 + (0.1 - 4 * 0.16) = 2.6 - 0.54 = 2.06
      expect(pattern.easeFactor).toBeCloseTo(2.06, 2);
    });
  });

  describe("toPlainObject serialization", () => {
    it("should return a plain object with all dates serialized as ISO strings and including SM-2 fields", () => {
      const pattern = MistakePattern.createNew({
        id: "pattern-1",
        userId: "user-123",
        conceptKey: "push_back",
        normalizedPhrase: "push back",
        senseKey: "sense-123",
        category: "phrasal_verb",
        errorType: "phrase_misunderstanding",
        meaningVi: "hoãn lại",
        safeReviewPromptVi: "Dịch câu sau: ...",
        isSensitive: false,
      });

      const plain = pattern.toPlainObject();

      expect(typeof plain.dueAt).toBe("string");
      expect(typeof plain.createdAt).toBe("string");
      expect(typeof plain.updatedAt).toBe("string");
      expect(plain.lastReviewedAt).toBeNull();
      expect(plain.occurrenceCount).toBe(1);
      expect(plain.intervalDays).toBe(0);
      expect(plain.easeFactor).toBe(2.5);
      expect(plain.repetitions).toBe(0);
      expect(plain.masteryState).toBe("active");
      expect(plain.id).toBe("pattern-1");
      expect(plain.userId).toBe("user-123");
    });
  });
});
