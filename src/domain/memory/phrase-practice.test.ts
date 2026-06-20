import { describe, expect, it } from "vitest";
import { PhrasePractice } from "./phrase-practice";

describe("PhrasePractice Domain Aggregate (SM-2)", () => {
  it("should create new phrase practices with correct default SM-2 state", () => {
    const practice = PhrasePractice.createNew({
      id: "practice-1",
      userId: "user-123",
      keyPhraseId: "phrase-123",
      conceptKey: "push_back",
      normalizedPhrase: "push back",
      senseKey: "sense-123",
      category: "phrasal_verb",
      meaningVi: "hoãn lại",
      isSensitive: false,
    });

    expect(practice.intervalDays).toBe(0);
    expect(practice.easeFactor).toBe(2.5);
    expect(practice.repetitions).toBe(0);
    expect(practice.masteryState).toBe("active");
    expect(practice.reviewPromptStatus).toBe("queued");
    expect(practice.dueAt).toBeInstanceOf(Date);
  });

  it("should check isDue correctly based on state and status", () => {
    const now = new Date(Date.now() + 1000);
    const practice = PhrasePractice.createNew({
      id: "practice-1",
      userId: "user-123",
      keyPhraseId: "phrase-123",
      conceptKey: "push_back",
      normalizedPhrase: "push back",
      senseKey: "sense-123",
      category: "phrasal_verb",
      meaningVi: "hoãn lại",
      isSensitive: false,
    });

    // Fresh practice has reviewPromptStatus = "queued", so isDue should be false
    expect(practice.isDue(now)).toBe(false);

    // Set to succeeded and due now
    practice.updateReviewPrompt({
      reviewType: "natural_translation",
      reviewPromptEn: "Let's push back the meeting.",
      reviewPromptVi: "Hãy hoãn cuộc họp lại.",
      reviewRubricVi: "Phải dịch đúng push back.",
      reviewCorrectAnswer: "Hãy hoãn cuộc họp lại.",
      reviewAcceptableAnswers: ["Hãy dời cuộc họp lại."],
      reviewChoices: null,
    });

    expect(practice.reviewPromptStatus).toBe("succeeded");
    expect(practice.isDue(now)).toBe(true);

    // If check time is in the past, it should not be due
    const past = new Date(Date.now() - 100000);
    expect(practice.isDue(past)).toBe(false);
  });

  describe("SM-2 scheduling calculations", () => {
    it("progresses intervals and adjusts Ease Factor correctly with perfect rating (q=5)", () => {
      const start = new Date("2026-06-14T12:00:00Z");
      const practice = PhrasePractice.createNew({
        id: "practice-1",
        userId: "user-123",
        keyPhraseId: "phrase-123",
        conceptKey: "push_back",
        normalizedPhrase: "push back",
        senseKey: "sense-123",
        category: "phrasal_verb",
        meaningVi: "hoãn lại",
        isSensitive: false,
      });

      // q = 5 (score >= 95)
      practice.recordReviewAttempt(true, 98, start);

      expect(practice.repetitions).toBe(1);
      expect(practice.intervalDays).toBe(1);
      expect(practice.easeFactor).toBeGreaterThan(2.5); // EF should increase

      const expectedDue = new Date(start);
      expectedDue.setDate(expectedDue.getDate() + 1);
      expect(practice.dueAt.toISOString()).toBe(expectedDue.toISOString());
    });
  });
});
