import { sha256, hashCanonicalPayload } from "@/lib/crypto";

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

const sensitivePatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\bhttps?:\/\/\S+/i,
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/,
  /\b[A-Z]{2,}-\d+\b/,
  /\b(?:project|client|customer|repo|repository|ticket|issue)\s+[A-Z0-9_-]{3,}\b/i,
];

export function getPlainTextFromJSON(node: any): string {
  if (!node) return "";
  if (node.type === "text") {
    return node.text || "";
  }
  if (node.content && Array.isArray(node.content)) {
    const isBlockContainer = node.type === "doc" || node.type === "bulletList" || node.type === "orderedList";
    return node.content.map(getPlainTextFromJSON).join(isBlockContainer ? "\n" : "");
  }
  return "";
}

export function getHighlightsFromJSON(node: any): string[] {
  if (!node) return [];
  const highlights: string[] = [];
  
  const traverse = (n: any) => {
    if (n.type === "text" && n.marks && Array.isArray(n.marks)) {
      const isHighlighted = n.marks.some((mark: any) => mark.type === "highlight");
      if (isHighlighted && n.text) {
        highlights.push(n.text.trim());
      }
    }
    if (n.content && Array.isArray(n.content)) {
      n.content.forEach(traverse);
    }
  };
  
  traverse(node);
  return Array.from(new Set(highlights)).filter(Boolean);
}

export class DefaultTextProcessor implements TextProcessor {
  processSource(content: string): { normalized: string; hash: string } {
    let plainText = content;
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object" && parsed.type === "doc") {
        plainText = getPlainTextFromJSON(parsed);
      }
    } catch {
      // Ignore JSON parse error, treat content as plain text
    }
    const normalized = plainText.replace(/\s+/g, " ").trim();
    const hash = sha256(content.trim());
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
