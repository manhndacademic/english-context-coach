import { sha256, hashCanonicalPayload } from "@/lib/crypto";

export interface TextProcessor {
  processSource(content: string): { normalized: string; hash: string };
  normalizePhrase(phrase: string): string;
  buildSenseKey(phrase: string, meaningVi: string, category: string): string;
  isSafe(text: string): boolean;
  shouldScrubMistakePattern(input: {
    phrase: string;
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
  if (node.type === "hardBreak") {
    return "\n";
  }
  if (node.content && Array.isArray(node.content)) {
    const isBlockContainer =
      node.type === "doc" ||
      node.type === "bulletList" ||
      node.type === "orderedList" ||
      node.type === "listItem" ||
      node.type === "blockquote" ||
      node.type === "codeBlock";
    return node.content
      .map(getPlainTextFromJSON)
      .join(isBlockContainer ? "\n" : "");
  }
  return "";
}

export function getHighlightsFromJSON(node: any): string[] {
  if (!node) return [];
  const highlights: string[] = [];
  let currentHighlight = "";

  const flush = () => {
    if (currentHighlight.trim()) {
      highlights.push(currentHighlight.trim());
    }
    currentHighlight = "";
  };

  const traverse = (n: any) => {
    if (!n) return;

    const isBlock = n.type && n.type !== "text" && n.type !== "hardBreak";
    if (isBlock) {
      flush();
    }

    if (n.type === "text") {
      const isHighlighted =
        n.marks &&
        Array.isArray(n.marks) &&
        n.marks.some((mark: any) => mark.type === "highlight");
      if (isHighlighted) {
        currentHighlight += n.text || "";
      } else {
        flush();
      }
    } else if (n.type === "hardBreak") {
      flush();
    }

    if (n.content && Array.isArray(n.content)) {
      n.content.forEach(traverse);
    }

    if (isBlock) {
      flush();
    }
  };

  traverse(node);
  flush();

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
    phrase: string;
    meaningVi: string;
    safeReviewPromptVi: string;
  }): boolean {
    return (
      !this.isSafe(input.phrase) ||
      !this.isSafe(input.meaningVi) ||
      !this.isSafe(input.safeReviewPromptVi)
    );
  }
}
