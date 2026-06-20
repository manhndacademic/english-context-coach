import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Removes embedded backticks and single quotes enclosing terms or phrases
 * (e.g. `push back` -> push back, 'catch up' -> catch up) inside sentences,
 * while preserving standard contractions (don't, it's, etc.) and punctuation.
 */
export function cleanEmbeddedQuotesOrBackticks(
  text: string | null | undefined
): string {
  if (!text) return "";

  // 1. Remove backticks enclosing any text: e.g. `hello` -> hello
  let cleaned = text.replace(/`([^`]+)`/g, "$1");

  // 2. Remove single quotes (straight or curly) enclosing a word/phrase:
  // e.g. 'hello' -> hello, ‘hello’ -> hello, 'push back' -> push back
  // Matches when preceded by boundary/whitespace/parenthesis/quotes and followed by boundary/whitespace/punctuation.
  cleaned = cleaned.replace(
    /(?<=^|\s|[([“"'‘])['‘]([^'’]+)['’](?=\s|$|[.,!?;:)\]}”"’])/g,
    "$1"
  );

  return cleaned;
}

export function translateCategory(category: string): string {
  const mapping: Record<string, string> = {
    idiom: "Thành ngữ",
    phrasal_verb: "Cụm động từ",
    technical_term: "Thuật ngữ kỹ thuật",
    collocation: "Collocation (Cấu kết từ)",
    grammar_pattern: "Cấu trúc ngữ pháp",
    business_phrase: "Cụm từ thương mại",
    general_phrase: "Cụm từ thông dụng",
  };
  return mapping[category] ?? category.replaceAll("_", " ");
}
