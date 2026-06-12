import { createHash } from "node:crypto";
import type { TextProcessor } from "../ports";

const sensitivePatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\bhttps?:\/\/\S+/i,
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/,
  /\b[A-Z]{2,}-\d+\b/,
  /\b(?:project|client|customer|repo|repository|ticket|issue)\s+[A-Z0-9_-]{3,}\b/i,
];

export class DefaultTextProcessor implements TextProcessor {
  processSource(content: string): { normalized: string; hash: string } {
    const normalized = content.replace(/\s+/g, " ").trim();
    const hash = createHash("sha256").update(normalized).digest("hex");
    return { normalized, hash };
  }

  normalizePhrase(phrase: string): string {
    return phrase
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[“”"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private hashCanonicalPayload(payload: unknown): string {
    const serialized = JSON.stringify(payload, Object.keys(payload as object).sort());
    return createHash("sha256").update(serialized).digest("hex");
  }

  buildSenseKey(phrase: string, meaningVi: string, category: string): string {
    return this.hashCanonicalPayload({
      category,
      meaningVi: meaningVi.toLowerCase().trim(),
      phrase: this.normalizePhrase(phrase),
    }).slice(0, 24);
  }

  isSafe(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return true; // Empty string is safe by default
    return !sensitivePatterns.some((pattern) => pattern.test(trimmed));
  }

  shouldScrubMistakePattern(input: {
    normalizedPhrase: string;
    meaningVi: string;
    safeReviewPromptVi: string;
  }): boolean {
    return (
      !this.isSafe(input.normalizedPhrase) ||
      !this.isSafe(input.meaningVi) ||
      !this.isSafe(input.safeReviewPromptVi)
    );
  }
}
