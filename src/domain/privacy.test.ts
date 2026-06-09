import { describe, expect, it } from "vitest";
import { containsSourceIdentifyingContent, shouldScrubMistakePattern } from "./privacy";

describe("privacy scrubbing", () => {
  it("detects source-identifying content", () => {
    expect(containsSourceIdentifyingContent("alice@example.com")).toBe(true);
    expect(containsSourceIdentifyingContent("PROJ-123")).toBe(true);
    expect(containsSourceIdentifyingContent("push back")).toBe(false);
  });

  it("scrubs sensitive mistake patterns", () => {
    expect(
      shouldScrubMistakePattern({
        normalizedPhrase: "api contract",
        meaningVi: "thỏa thuận request/response giữa hệ thống",
        safeReviewPromptVi: "Ôn lại cụm api contract.",
      }),
    ).toBe(false);

    expect(
      shouldScrubMistakePattern({
        normalizedPhrase: "Alice Nguyen",
        meaningVi: "tên người trong nội dung nguồn",
        safeReviewPromptVi: "Ôn lại Alice Nguyen.",
      }),
    ).toBe(true);
  });
});
