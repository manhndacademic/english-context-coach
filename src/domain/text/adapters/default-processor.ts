import type { TextProcessor } from "../ports";
import { sha256, hashCanonicalPayload } from "@/lib/crypto";

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
    const hash = sha256(normalized);
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

  buildSenseKey(phrase: string, meaningVi: string, category: string): string {
    return hashCanonicalPayload({
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
