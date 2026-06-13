import { describe, expect, it } from "vitest";
import { buildCompletionStats, completionMistakePatternKey } from "./completion-summary-stats";

describe("buildCompletionStats", () => {
  it("summarizes first-try correctness, saved UserErrors, repeated errors, and next review date", () => {
    const stats = buildCompletionStats({
      items: [
        {
          attempts: [
            { id: "attempt-2", isCorrect: true },
            { id: "attempt-1", isCorrect: false },
          ],
        },
        {
          attempts: [{ id: "attempt-3", isCorrect: true }],
        },
        {
          attempts: [
            { id: "attempt-5", isCorrect: true },
            { id: "attempt-4", isCorrect: false },
          ],
        },
      ],
      userErrorsByAttemptId: new Map([
        [
          "attempt-1",
          {
            attemptId: "attempt-1",
            conceptKey: "push_back",
            errorType: "phrase_misunderstanding",
            isRepeated: false,
          },
        ],
        [
          "attempt-4",
          {
            attemptId: "attempt-4",
            conceptKey: "api_contract",
            errorType: "technical_term_misunderstanding",
            isRepeated: true,
          },
        ],
      ]),
      mistakePatternsByKey: new Map([
        [
          completionMistakePatternKey("push_back", "phrase_misunderstanding"),
          {
            conceptKey: "push_back",
            errorType: "phrase_misunderstanding",
            dueAt: "2026-06-14T00:00:00.000Z",
            masteryState: "active",
          },
        ],
        [
          completionMistakePatternKey("api_contract", "technical_term_misunderstanding"),
          {
            conceptKey: "api_contract",
            errorType: "technical_term_misunderstanding",
            dueAt: "2026-06-13T00:00:00.000Z",
            masteryState: "active",
          },
        ],
      ]),
    });

    expect(stats).toEqual({
      total: 3,
      correctFirstTry: 1,
      newMistakesSaved: 1,
      repeatedErrors: 1,
      nextReviewAt: "2026-06-13T00:00:00.000Z",
    });
  });
});
