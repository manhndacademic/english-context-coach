import type { DiffSpan } from "@/lib/ai/schemas";
import { computeCharDiff, isNoDiff } from "@/lib/diff";

interface InlineDiffProps {
  /** The original (possibly incorrect) sentence */
  original: string;
  /** The corrected sentence; null means no correction needed */
  corrected: string | null | undefined;
  /** Pre-computed diff spans from AI or DB; falls back to Myers LCS if absent */
  diffSpans?: DiffSpan[] | null;
  /**
   * - "unified": renders both delete and insert spans inline in sequence (default)
   * - "original": renders equal spans and delete spans (inserts hidden)
   * - "corrected": renders equal spans and insert spans (deletes hidden)
   */
  view?: "original" | "corrected" | "unified";
  className?: string;
}

/**
 * Renders an inline GitHub-style character diff between original and corrected text.
 *
 * - "unified" view: renders both delete (red strikethrough) and insert (green bold) inline
 * - "original" view: equal spans in normal text, delete spans in red strikethrough
 * - "corrected" view: equal spans in normal text, insert spans in green bold
 * - If no diff (equal sentences): shows badge "✅ Không có lỗi"
 */
export function InlineDiff({
  original,
  corrected,
  diffSpans,
  view = "unified",
  className,
}: InlineDiffProps) {
  // No correction or same text → no-error state
  if (!corrected || corrected.trim() === original.trim()) {
    return (
      <span className={className}>
        <span className="font-serif text-base leading-relaxed text-text">
          {original}
        </span>
        <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded bg-success-light text-success border border-success/20 align-middle">
          ✅ Không có lỗi
        </span>
      </span>
    );
  }

  // Use AI/DB spans if valid, otherwise fall back to Myers LCS
  const spans: DiffSpan[] =
    diffSpans && diffSpans.length > 0
      ? diffSpans
      : computeCharDiff(original, corrected);

  // If everything is equal (AI returned all-equal spans), also show no-error badge
  if (isNoDiff(spans)) {
    return (
      <span className={className}>
        <span className="font-serif text-base leading-relaxed text-text">
          {original}
        </span>
        <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded bg-success-light text-success border border-success/20 align-middle">
          ✅ Không có lỗi
        </span>
      </span>
    );
  }

  return (
    <span className={className}>
      {spans.map((span, i) => {
        if (span.type === "equal") {
          return (
            <span key={i} className="font-serif text-base leading-relaxed">
              {span.text}
            </span>
          );
        }

        if (
          span.type === "delete" &&
          (view === "original" || view === "unified")
        ) {
          return (
            <span
              key={i}
              className="font-serif text-base leading-relaxed
                bg-danger-light dark:bg-[rgba(244,63,94,0.18)]
                text-danger dark:text-[#ff8585]
                line-through
                rounded-[3px] px-px"
            >
              {span.text}
            </span>
          );
        }

        if (
          span.type === "insert" &&
          (view === "corrected" || view === "unified")
        ) {
          return (
            <span
              key={i}
              className="font-serif text-base leading-relaxed font-bold
                bg-success-light dark:bg-[rgba(16,185,129,0.18)]
                text-success dark:text-[#a7f3d0]
                rounded-[3px] px-px"
            >
              {span.text}
            </span>
          );
        }

        // Hide opposite side's diff in specific view modes
        return null;
      })}
    </span>
  );
}
