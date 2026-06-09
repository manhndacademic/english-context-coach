import React from "react";
import type { ReactNode } from "react";

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
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|(?<=^|\s)'[\p{L}\s\-_/]{2,}'(?=\s|$|[.,!?;:]))/gu;

  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code className="inline-phrase" key={index}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("'") && part.endsWith("'")) {
      return (
        <code className="inline-phrase" key={index}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
