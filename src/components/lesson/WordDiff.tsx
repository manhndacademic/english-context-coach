import { computeWordDiff, isNoDiff } from "@/lib/diff";

interface WordDiffProps {
  /** The original text (user's answer) */
  original: string;
  /** The corrected text (natural answer from AI); null means no correction */
  corrected: string | null | undefined;
  className?: string;
}

/**
 * Renders a word-level diff between the user's answer and the natural answer.
 *
 * - "delete" spans: red strikethrough — words the user wrote but shouldn't have
 * - "insert" spans: green bold — words from the natural answer that replace/add
 * - "equal" spans: normal text — words that are the same
 * - If no diff (identical or corrected is null): shows ✅ Không có lỗi badge
 *
 * Designed for Vietnamese translation comparison in GradingFeedback.
 */
export function WordDiff({ original, corrected, className }: WordDiffProps) {
  // No correction or same text → no-error state
  if (!corrected || corrected.trim() === original.trim()) {
    return (
      <span className={className}>
        <span className="text-sm leading-relaxed text-text">{original}</span>
        <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded bg-success-light text-success border border-success/20 align-middle">
          ✅ Không có lỗi
        </span>
      </span>
    );
  }

  const spans = computeWordDiff(original, corrected);

  // If everything resolves to equal spans, show no-error badge
  if (isNoDiff(spans)) {
    return (
      <span className={className}>
        <span className="text-sm leading-relaxed text-text">{original}</span>
        <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded bg-success-light text-success border border-success/20 align-middle">
          ✅ Không có lỗi
        </span>
      </span>
    );
  }

  return (
    <span className={className}>
      {spans.map((span, i) => {
        const key = `${span.type}-${span.text}-${i}`;
        if (span.type === "equal") {
          return (
            <span
              key={key}
              data-diff-type="equal"
              className="text-sm leading-relaxed"
            >
              {span.text}
            </span>
          );
        }

        if (span.type === "delete") {
          return (
            <span
              key={key}
              data-diff-type="delete"
              className="text-sm leading-relaxed
                bg-danger-light dark:bg-[rgba(244,63,94,0.18)]
                text-danger dark:text-[#ff8585]
                line-through
                rounded-[3px] px-px"
            >
              {span.text}
            </span>
          );
        }

        if (span.type === "insert") {
          return (
            <span
              key={key}
              data-diff-type="insert"
              className="text-sm leading-relaxed font-bold
                bg-success-light dark:bg-[rgba(16,185,129,0.18)]
                text-success dark:text-[#a7f3d0]
                rounded-[3px] px-px"
            >
              {span.text}
            </span>
          );
        }

        return null;
      })}
    </span>
  );
}
