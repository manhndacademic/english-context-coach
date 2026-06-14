import { describe, expect, it } from "vitest";
import { MistakePattern } from "./mistake-pattern";

describe("MistakePattern Domain Aggregate", () => {
  it("should create new mistake patterns with correct default Leitner state", () => {
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

  it("should increment occurrence correctly and reset review state", () => {
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

    // Make it mastered first
    pattern.recordReviewAttempt(true, new Date()); // interval = 1
    pattern.recordReviewAttempt(true, new Date()); // interval = 3
    pattern.recordReviewAttempt(true, new Date()); // interval = 7
    pattern.recordReviewAttempt(true, new Date()); // interval = 14 -> mastered
    expect(pattern.masteryState).toBe("mastered");

    // Re-encountering the mistake
    pattern.incrementOccurrence();
    expect(pattern.occurrenceCount).toBe(2);
    expect(pattern.intervalDays).toBe(0);
    expect(pattern.masteryState).toBe("active");
  });

  describe("Leitner scheduling calculations", () => {
    it("should calculate correct next intervals upon success", () => {
      expect(MistakePattern.nextReviewAfterSuccess(0)).toBe(1);
      expect(MistakePattern.nextReviewAfterSuccess(1)).toBe(3);
      expect(MistakePattern.nextReviewAfterSuccess(3)).toBe(7);
      expect(MistakePattern.nextReviewAfterSuccess(7)).toBe(14);
      expect(MistakePattern.nextReviewAfterSuccess(14)).toBe(14);
    });

    it("should compute correct next due date based on interval days", () => {
      const start = new Date("2026-06-14T12:00:00Z");
      const nextDue = MistakePattern.nextDueDate(3, start);
      expect(nextDue.getUTCDate()).toBe(17);
    });

    it("should reset due date to 1 day after failure", () => {
      const start = new Date("2026-06-14T12:00:00Z");
      const failureDue = MistakePattern.resetDueAfterFailure(start);
      expect(failureDue.getUTCDate()).toBe(15);
    });

    it("should calculate correct mastery state transition", () => {
      expect(MistakePattern.masteryStateAfterReview(true, 7)).toBe("active");
      expect(MistakePattern.masteryStateAfterReview(true, 14)).toBe("mastered");
      expect(MistakePattern.masteryStateAfterReview(false, 14)).toBe("active");
    });
  });

  describe("recordReviewAttempt transitions", () => {
    it("should transition correctly on successful review and progress intervals", () => {
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

      // 1st success -> interval = 1, due in 1 day
      pattern.recordReviewAttempt(true, start);
      expect(pattern.intervalDays).toBe(1);
      expect(pattern.masteryState).toBe("active");
      expect(pattern.dueAt.getUTCDate()).toBe(15);

      // 2nd success -> interval = 3, due in 3 days
      pattern.recordReviewAttempt(true, start);
      expect(pattern.intervalDays).toBe(3);
      expect(pattern.dueAt.getUTCDate()).toBe(17);
    });

    it("should reset interval to 0 and set due in 1 day upon failure", () => {
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

      // Advance to interval = 7
      pattern.recordReviewAttempt(true, start);
      pattern.recordReviewAttempt(true, start);
      pattern.recordReviewAttempt(true, start);
      expect(pattern.intervalDays).toBe(7);

      // Failure
      pattern.recordReviewAttempt(false, start);
      expect(pattern.intervalDays).toBe(0);
      expect(pattern.masteryState).toBe("active");
      expect(pattern.dueAt.getUTCDate()).toBe(15);
    });
  });
});
