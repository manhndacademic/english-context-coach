import { describe, expect, it } from "vitest";
import { getReviewDisclosureState } from "./review-disclosure";

describe("getReviewDisclosureState", () => {
  it("hides correct meaning and old mistake context before the review answer is submitted", () => {
    expect(getReviewDisclosureState(false)).toEqual({
      showPreAnswerPrompt: true,
      showCorrectMeaning: false,
      showOldMistakeContext: false,
    });
  });

  it("reveals correct meaning and old mistake context after submit", () => {
    expect(getReviewDisclosureState(true)).toEqual({
      showPreAnswerPrompt: false,
      showCorrectMeaning: true,
      showOldMistakeContext: true,
    });
  });
});
