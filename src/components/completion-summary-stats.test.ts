import { describe, expect, it } from "vitest";
import { buildCompletionStats } from "./completion-summary-stats";

describe("buildCompletionStats", () => {
  it("summarizes first-try correctness, saved UserErrors, repeated errors, and next review date", () => {
    const stats = buildCompletionStats([
      {
        attempts: [
          { id: "attempt-2", isCorrect: true },
          { id: "attempt-1", isCorrect: false },
        ],
        userError: {
          isRepeated: false,
          conceptKey: "push_back",
          errorType: "phrase_misunderstanding",
        },
        mistakePattern: {
          dueAt: new Date("2026-06-14T00:00:00.000Z"),
          masteryState: "active",
        },
      },
      {
        attempts: [{ id: "attempt-3", isCorrect: true }],
      },
      {
        attempts: [
          { id: "attempt-5", isCorrect: true },
          { id: "attempt-4", isCorrect: false },
        ],
        userError: {
          isRepeated: true,
          conceptKey: "api_contract",
          errorType: "technical_term_misunderstanding",
        },
        mistakePattern: {
          dueAt: new Date("2026-06-13T00:00:00.000Z"),
          masteryState: "active",
        },
      },
    ]);

    expect(stats).toEqual({
      total: 3,
      correctFirstTry: 1,
      newMistakesSaved: 1,
      repeatedErrors: 1,
      nextReviewAt: "2026-06-13T00:00:00.000Z",
    });
  });
});
