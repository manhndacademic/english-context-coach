import type { ReactNode } from "react";
import type { KeyPhrase } from "@/domain/lesson";

/**
 * Parses a string containing simple markdown formatting (backticks, bold, italics)
 * or fallback single quotes and returns an array of ReactNode elements.
 */
export function renderRichText(text: string | null | undefined): ReactNode {
  if (!text) return null;

  // Split by:
  // 1. Markdown backticks: `code`
  // 2. Markdown bold: **bold**
  // 3. Markdown italic: *italic*
  // 4. Single quotes with word boundaries to avoid matching apostrophes like "don't": 'phrase'
  const regex =
    /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|(?<=^|\s)'[\p{L}\s\-_/]{2,}'(?=\s|$|[.,!?;:]))/gu;

  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    const key = `${part}-${index}`;
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          className="font-mono text-[0.9em] bg-accent/8 border border-accent/18 text-accent-strong rounded-[4px] px-[5px] py-[1px] font-semibold [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
          key={key}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("'") && part.endsWith("'")) {
      return (
        <code
          className="font-mono text-[0.9em] bg-accent/8 border border-accent/18 text-accent-strong rounded-[4px] px-[5px] py-[1px] font-semibold [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
          key={key}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function isBoundary(value: string | undefined) {
  return !value || !/[\p{L}\p{N}_]/u.test(value);
}

export function findHighlightRanges(source: string, phrases: KeyPhrase[]) {
  const lowerSource = source.toLowerCase();
  const ranges: Array<{ end: number; phraseId: string; start: number }> = [];
  const candidates = [...phrases].sort(
    (a, b) => b.phrase.length - a.phrase.length
  );

  for (const phrase of candidates) {
    const phraseText = phrase.phrase.trim();
    if (!phraseText) continue;

    const shortSingleWord = phraseText.length < 4 && !/\s/.test(phraseText);
    const haystack = shortSingleWord ? source : lowerSource;
    const needle = shortSingleWord ? phraseText : phraseText.toLowerCase();
    let index = haystack.indexOf(needle);

    while (index !== -1) {
      const end = index + needle.length;
      const hasBoundaries =
        isBoundary(source[index - 1]) && isBoundary(source[end]);
      const overlaps = ranges.some(
        (range) => index < range.end && end > range.start
      );

      if (hasBoundaries && !overlaps) {
        ranges.push({ start: index, end, phraseId: phrase.id });
      }

      index = haystack.indexOf(needle, index + needle.length);
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
}
