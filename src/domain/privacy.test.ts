import { describe, expect, it } from "vitest";
import { containsSourceIdentifyingContent, shouldRetainAfterSourceDeletion, shouldScrubMistakePattern } from "./privacy";

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

  it("retains patterns and concepts when other source evidence remains", () => {
    expect(shouldRetainAfterSourceDeletion({
      evidenceCountBeforeDeletion: 3,
      evidenceCountFromDeletedSource: 1,
    })).toEqual({ remainingEvidence: 2, retainPatternOrConcept: true });
  });

  it("removes patterns and concepts when the deleted source held the last evidence", () => {
    expect(shouldRetainAfterSourceDeletion({
      evidenceCountBeforeDeletion: 1,
      evidenceCountFromDeletedSource: 1,
    })).toEqual({ remainingEvidence: 0, retainPatternOrConcept: false });
  });
});
