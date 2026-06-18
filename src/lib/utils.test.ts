import { describe, it, expect } from "vitest";
import { cleanEmbeddedQuotesOrBackticks } from "./utils";

describe("cleanEmbeddedQuotesOrBackticks", () => {
  it("should handle empty or null values", () => {
    expect(cleanEmbeddedQuotesOrBackticks(null)).toBe("");
    expect(cleanEmbeddedQuotesOrBackticks(undefined)).toBe("");
    expect(cleanEmbeddedQuotesOrBackticks("")).toBe("");
  });

  it("should strip backticks enclosing any text", () => {
    expect(
      cleanEmbeddedQuotesOrBackticks("Please `push back` the meeting.")
    ).toBe("Please push back the meeting.");
    expect(cleanEmbeddedQuotesOrBackticks("We should `excel at` this.")).toBe(
      "We should excel at this."
    );
  });

  it("should strip straight single quotes enclosing a word or phrase", () => {
    expect(
      cleanEmbeddedQuotesOrBackticks("Please 'push back' the meeting.")
    ).toBe("Please push back the meeting.");
    expect(cleanEmbeddedQuotesOrBackticks("We should 'excel at' this.")).toBe(
      "We should excel at this."
    );
    expect(
      cleanEmbeddedQuotesOrBackticks("'push back' is a phrasal verb.")
    ).toBe("push back is a phrasal verb.");
  });

  it("should strip curly single quotes enclosing a word or phrase", () => {
    expect(
      cleanEmbeddedQuotesOrBackticks("Please ‘push back’ the meeting.")
    ).toBe("Please push back the meeting.");
    expect(cleanEmbeddedQuotesOrBackticks("We should ‘excel at’ this.")).toBe(
      "We should excel at this."
    );
  });

  it("should preserve contractions and possessives", () => {
    expect(
      cleanEmbeddedQuotesOrBackticks("Don't 'push back' the meeting.")
    ).toBe("Don't push back the meeting.");
    expect(cleanEmbeddedQuotesOrBackticks("It's his 'personal choice'.")).toBe(
      "It's his personal choice."
    );
    expect(
      cleanEmbeddedQuotesOrBackticks("This is the user's 'excel at' attempt.")
    ).toBe("This is the user's excel at attempt.");
  });

  it("should strip quotes followed by common punctuation", () => {
    expect(cleanEmbeddedQuotesOrBackticks("We have to 'catch up'.")).toBe(
      "We have to catch up."
    );
    expect(
      cleanEmbeddedQuotesOrBackticks("If we 'catch up', we will succeed.")
    ).toBe("If we catch up, we will succeed.");
    expect(cleanEmbeddedQuotesOrBackticks("Can we 'catch up'?")).toBe(
      "Can we catch up?"
    );
    expect(cleanEmbeddedQuotesOrBackticks("Let's 'catch up'; it's time.")).toBe(
      "Let's catch up; it's time."
    );
  });

  it("should strip quotes enclosed in parentheses or brackets", () => {
    expect(
      cleanEmbeddedQuotesOrBackticks("We need to catch up ('excel at').")
    ).toBe("We need to catch up (excel at).");
  });

  it("should handle multiple occurrences in a single string", () => {
    expect(
      cleanEmbeddedQuotesOrBackticks(
        "You must 'deal with' the issue and 'catch up' with the team."
      )
    ).toBe("You must deal with the issue and catch up with the team.");
  });
});
