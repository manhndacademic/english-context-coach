import { describe, expect, it } from "vitest";
import {
  buildReviewPromptSnapshot,
  buildSafeReviewSeed,
  conceptTitleVi,
  deterministicConceptKey,
  nextDueDate,
  nextReviewAfterSuccess,
  resetDueAfterFailure,
  transitionMastery,
} from "./review";

describe("review scheduling", () => {
  it("advances through simple review intervals", () => {
    expect(nextReviewAfterSuccess(0)).toBe(1);
    expect(nextReviewAfterSuccess(1)).toBe(3);
    expect(nextReviewAfterSuccess(3)).toBe(7);
    expect(nextReviewAfterSuccess(7)).toBe(14);
    expect(nextReviewAfterSuccess(14)).toBe(14);
  });

  it("computes due dates from a fixed date", () => {
    const from = new Date("2026-06-09T00:00:00Z");
    expect(nextDueDate(3, from).toISOString()).toBe("2026-06-12T00:00:00.000Z");
    expect(resetDueAfterFailure(from).toISOString()).toBe("2026-06-10T00:00:00.000Z");
  });

  it("moves through explicit mastery states on successful reviews", () => {
    expect(transitionMastery({
      currentState: "new",
      currentIntervalDays: 0,
      result: "correct",
      gradingStatus: "succeeded",
    })).toMatchObject({ nextState: "learning", nextIntervalDays: 1, shouldSchedule: true });

    expect(transitionMastery({
      currentState: "learning",
      currentIntervalDays: 1,
      result: "correct",
      gradingStatus: "succeeded",
    })).toMatchObject({ nextState: "reviewing", nextIntervalDays: 3 });

    expect(transitionMastery({
      currentState: "reviewing",
      currentIntervalDays: 14,
      result: "correct",
      gradingStatus: "succeeded",
    })).toMatchObject({ nextState: "mastered", nextIntervalDays: 14 });
  });

  it("moves failed reviews to relearning but ignores grading failures", () => {
    expect(transitionMastery({
      currentState: "reviewing",
      currentIntervalDays: 7,
      result: "incorrect",
      gradingStatus: "succeeded",
    })).toMatchObject({ nextState: "relearning", nextIntervalDays: 1, shouldSchedule: true });

    expect(transitionMastery({
      currentState: "reviewing",
      currentIntervalDays: 7,
      result: "grading_failed",
      gradingStatus: "failed",
    })).toMatchObject({ nextState: "reviewing", nextIntervalDays: 7, shouldSchedule: false });
  });

  it("aggregates related schedule movement phrasal verbs into one concept", () => {
    const base = {
      category: "phrasal_verb",
      errorType: "phrasal_verb_error",
      meaningVi: "dời cuộc họp lại muộn hơn",
      explanationVi: "Không phải đẩy vật gì ra sau.",
    };

    expect(deterministicConceptKey({
      ...base,
      normalizedPhrase: "push this back",
      senseKey: "push-back-schedule",
    })).toBe("phrasal_verb:schedule_movement_back");

    expect(deterministicConceptKey({
      ...base,
      normalizedPhrase: "move the meeting back",
      senseKey: "move-back-schedule",
    })).toBe("phrasal_verb:schedule_movement_back");
  });

  it("keeps unrelated senses separate", () => {
    const common = {
      normalizedPhrase: "back up",
      category: "phrasal_verb",
      errorType: "phrasal_verb_error",
      explanationVi: "Different senses.",
    };

    expect(deterministicConceptKey({
      ...common,
      senseKey: "backup-data",
      meaningVi: "sao lưu dữ liệu",
    })).not.toBe(deterministicConceptKey({
      ...common,
      senseKey: "support-claim",
      meaningVi: "ủng hộ một lập luận",
    }));
  });

  it("builds safe review prompts without original source sentences", () => {
    const prompt = buildReviewPromptSnapshot({
      conceptTitleVi: "Cụm động từ diễn tả dời lịch",
      fallbackMeaningVi: "dời lại",
      safeReviewSeed: {
        phrase: "push back",
        meaningVi: "dời lại",
      },
    });

    expect(prompt.promptEn).toContain("dời lại");
    expect(prompt.promptEn).not.toContain("Alice");
    expect(prompt.correctAnswer).toBe("push back");
  });

  it("scrubs sensitive identifiers from long-term review seeds", () => {
    const seed = {
      normalizedPhrase: "Alice Project ZETA-123",
      senseKey: "private-project",
      category: "business_phrase",
      errorType: "literal_translation",
      meaningVi: "Alice cần dời dự án ZETA-123.",
      explanationVi: "Private explanation.",
      isSensitive: true,
    };

    expect(conceptTitleVi(seed)).not.toContain("Alice");
    expect(buildSafeReviewSeed(seed)).not.toHaveProperty("phrase");
    expect(JSON.stringify(buildSafeReviewSeed(seed))).not.toContain("ZETA-123");
  });
});
