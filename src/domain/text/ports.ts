export interface TextProcessor {
  processSource(content: string): { normalized: string; hash: string };
  normalizePhrase(phrase: string): string;
  buildSenseKey(phrase: string, meaningVi: string, category: string): string;
  isSafe(text: string): boolean;
  shouldScrubMistakePattern(input: {
    normalizedPhrase: string;
    meaningVi: string;
    safeReviewPromptVi: string;
  }): boolean;
}
