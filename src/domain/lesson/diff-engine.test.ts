import { describe, expect, it } from "vitest";
import { diffWords, extractDiffPairs } from "./diff-engine";

describe("Deterministic Word Diffing", () => {
  describe("diffWords", () => {
    it("identifies single word corrections", () => {
      const draft = "I very like this.";
      const source = "I really like this.";
      const changes = diffWords(draft, source);

      // Check that "very" is deleted and "really" is inserted
      expect(changes).toContainEqual({ type: "delete", text: "very" });
      expect(changes).toContainEqual({ type: "insert", text: "really" });
    });

    it("handles multiple changes and matching words", () => {
      const draft = "Yesterday I go to office and say hi.";
      const source = "Yesterday I went to office and said hi.";
      const changes = diffWords(draft, source);

      expect(changes).toContainEqual({ type: "delete", text: "go" });
      expect(changes).toContainEqual({ type: "insert", text: "went" });
      expect(changes).toContainEqual({ type: "delete", text: "say" });
      expect(changes).toContainEqual({ type: "insert", text: "said" });
    });
  });

  describe("extractDiffPairs", () => {
    it("extracts clean correction pairs from simple diff changes", () => {
      const draft = "I very like this.";
      const source = "I really like this.";
      const changes = diffWords(draft, source);
      const pairs = extractDiffPairs(changes);

      expect(pairs).toHaveLength(1);
      expect(pairs[0]).toEqual({
        draft: "very",
        corrected: "really",
      });
    });

    it("extracts multiple correction pairs correctly", () => {
      const draft =
        "Yesterday I go to office and my manager say we should draw up a plan.";
      const source =
        "Yesterday I went to the office and my manager said we should draw up a plan.";
      const changes = diffWords(draft, source);
      const pairs = extractDiffPairs(changes);

      expect(pairs.length).toBeGreaterThanOrEqual(2);

      const hasGoWent = pairs.some(
        (p) => p.draft.includes("go") && p.corrected.includes("went")
      );
      const hasSaySaid = pairs.some(
        (p) => p.draft === "say" && p.corrected === "said"
      );

      expect(hasGoWent).toBe(true);
      expect(hasSaySaid).toBe(true);
    });

    it("returns empty list if texts are identical", () => {
      const text = "This is a clean sentence.";
      const changes = diffWords(text, text);
      const pairs = extractDiffPairs(changes);
      expect(pairs).toHaveLength(0);
    });
  });
});
