import { describe, it, expect } from "vitest";
import { computeCharDiff, isNoDiff } from "./diff";

describe("computeCharDiff", () => {
  it("returns single equal span when strings are identical", () => {
    const result = computeCharDiff("hello world", "hello world");
    expect(result).toEqual([{ type: "equal", text: "hello world" }]);
  });

  it("returns single equal span when corrected is null", () => {
    const result = computeCharDiff("hello", null);
    expect(result).toEqual([{ type: "equal", text: "hello" }]);
  });

  it("returns single equal span when corrected is undefined", () => {
    const result = computeCharDiff("hello", undefined);
    expect(result).toEqual([{ type: "equal", text: "hello" }]);
  });

  it('handles simple insertion: "take" → "to take"', () => {
    const result = computeCharDiff("take", "to take");
    const insertSpan = result.find((s) => s.type === "insert");
    const equalSpan = result.find((s) => s.type === "equal");
    expect(insertSpan).toBeDefined();
    expect(equalSpan?.text).toContain("take");
    // Reconstruct corrected from spans
    const corrected = result
      .filter((s) => s.type !== "delete")
      .map((s) => s.text)
      .join("");
    expect(corrected).toBe("to take");
  });

  it("reconstructs original from delete+equal spans", () => {
    const result = computeCharDiff(
      "I'm waiting for my wife take a shower",
      "I'm waiting for my wife to take a shower"
    );
    const original = result
      .filter((s) => s.type !== "insert")
      .map((s) => s.text)
      .join("");
    expect(original).toBe("I'm waiting for my wife take a shower");
  });

  it("reconstructs corrected from insert+equal spans", () => {
    const result = computeCharDiff(
      "I'm waiting for my wife take a shower",
      "I'm waiting for my wife to take a shower"
    );
    const corrected = result
      .filter((s) => s.type !== "delete")
      .map((s) => s.text)
      .join("");
    expect(corrected).toBe("I'm waiting for my wife to take a shower");
  });

  it("handles deletion: 'very like' → 'like'", () => {
    const result = computeCharDiff("I very like this", "I like this");
    const deleteSpan = result.find((s) => s.type === "delete");
    expect(deleteSpan).toBeDefined();
    const corrected = result
      .filter((s) => s.type !== "delete")
      .map((s) => s.text)
      .join("");
    expect(corrected).toBe("I like this");
  });

  it("handles substitution: 'go' → 'went'", () => {
    const result = computeCharDiff("Yesterday I go", "Yesterday I went");
    const corrected = result
      .filter((s) => s.type !== "delete")
      .map((s) => s.text)
      .join("");
    expect(corrected).toBe("Yesterday I went");
  });

  it("handles empty original string", () => {
    const result = computeCharDiff("", "hello");
    expect(result.some((s) => s.type === "insert")).toBe(true);
  });

  it("handles empty corrected string — treated as no correction (same as null)", () => {
    // An empty corrected string means "no correction provided" — returns equal span
    const result = computeCharDiff("hello", "");
    expect(result).toEqual([{ type: "equal", text: "hello" }]);
  });

  it("merges consecutive spans of same type", () => {
    const result = computeCharDiff("abc", "axc");
    // Should not have two consecutive "equal" spans
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].type).not.toBe(result[i + 1].type);
    }
  });

  it("handles punctuation correctly", () => {
    const result = computeCharDiff("Hello, world!", "Hello world!");
    const corrected = result
      .filter((s) => s.type !== "delete")
      .map((s) => s.text)
      .join("");
    expect(corrected).toBe("Hello world!");
  });
});

describe("isNoDiff", () => {
  it("returns true when all spans are equal", () => {
    expect(isNoDiff([{ type: "equal", text: "abc" }])).toBe(true);
  });

  it("returns false when there is a delete span", () => {
    expect(
      isNoDiff([
        { type: "equal", text: "a" },
        { type: "delete", text: "b" },
      ])
    ).toBe(false);
  });

  it("returns false when there is an insert span", () => {
    expect(
      isNoDiff([
        { type: "insert", text: "x" },
        { type: "equal", text: "abc" },
      ])
    ).toBe(false);
  });
});
