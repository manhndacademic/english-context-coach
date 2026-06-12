import { describe, expect, it } from "vitest";
import { getTextProcessor } from "../index";

describe("DefaultTextProcessor", () => {
  const processor = getTextProcessor();

  it("normalizes source text and hashes it", () => {
    const { normalized, hash } = processor.processSource("  We\n need   this. ");
    expect(normalized).toBe("We need this.");
    expect(hash).toHaveLength(64);
  });

  it("normalizes phrases", () => {
    expect(processor.normalizePhrase(" “Push   Back” ")).toBe("push back");
  });

  it("builds stable phrase sense keys", () => {
    expect(processor.buildSenseKey("push back", "dời lại", "phrasal_verb")).toBe(
      processor.buildSenseKey("Push Back", "dời lại", "phrasal_verb"),
    );
  });

  it("detects source-identifying content (isSafe)", () => {
    expect(processor.isSafe("alice@example.com")).toBe(false);
    expect(processor.isSafe("PROJ-123")).toBe(false);
    expect(processor.isSafe("push back")).toBe(true);
  });

  it("scrubs sensitive mistake patterns", () => {
    expect(
      processor.shouldScrubMistakePattern({
        normalizedPhrase: "api contract",
        meaningVi: "thỏa thuận request/response giữa hệ thống",
        safeReviewPromptVi: "Ôn lại cụm api contract.",
      }),
    ).toBe(false);

    expect(
      processor.shouldScrubMistakePattern({
        normalizedPhrase: "Alice Nguyen",
        meaningVi: "tên người trong nội dung nguồn",
        safeReviewPromptVi: "Ôn lại Alice Nguyen.",
      }),
    ).toBe(true);
  });
});
