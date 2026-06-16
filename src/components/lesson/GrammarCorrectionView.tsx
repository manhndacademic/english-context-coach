import { SentenceBreakdownPanel } from "./SentenceBreakdownPanel";
import { SourceMeaningPanel } from "./SourceMeaningPanel";
import { InlineDiff } from "./InlineDiff";
import type { DiffSpan } from "@/lib/ai/schemas";

interface GrammarCorrectionViewProps {
  lesson: {
    summaryVi: string | null;
    naturalTranslationVi: string | null;
    contextExplanationVi: string | null;
  };
  sentenceBreakdowns: Array<{
    id: string;
    sentence: string;
    correctedSentenceEn: string | null;
    diffSpans?: DiffSpan[] | null;
    naturalMeaningVi: string;
    structureNotesVi: string;
    toneOrContextVi: string | null;
  }>;
  lessonFocuses: Array<{
    id: string;
    title: string;
    explanationVi: string;
    category: string;
    difficulty: string;
  }>;
}

export function GrammarCorrectionView({
  lesson,
  sentenceBreakdowns,
  lessonFocuses,
}: GrammarCorrectionViewProps) {
  const originalParagraph = sentenceBreakdowns
    .map((b) => b.sentence.trim())
    .join(" ");
  const correctedParagraph = sentenceBreakdowns
    .map((b) => (b.correctedSentenceEn || b.sentence).trim())
    .join(" ");

  const hasCorrection = originalParagraph !== correctedParagraph;

  return (
    <>
      {/* Comparison Panel */}
      <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
        <div>
          <h2 className="text-2xl font-bold text-text m-0">
            So sánh văn bản (Text Comparison)
          </h2>
          <p className="text-xs text-muted leading-relaxed m-0 mt-1">
            Xem tổng quan sự khác biệt giữa văn bản gốc của bạn và bản chỉnh sửa
            hoàn chỉnh.
          </p>
        </div>

        {hasCorrection ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Original Box */}
            <div className="p-5 rounded-lg border border-danger/20 bg-danger-light text-danger flex flex-col gap-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-danger/80">
                Bản gốc của bạn (Original)
              </div>
              <p className="m-0 font-serif text-base leading-relaxed break-words">
                <InlineDiff
                  original={originalParagraph}
                  corrected={correctedParagraph}
                  view="original"
                />
              </p>
            </div>

            {/* Corrected Box */}
            <div className="p-5 rounded-lg border border-success/20 bg-success-light text-success flex flex-col gap-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-success/80 flex items-center gap-1.5">
                <span>Đề xuất chỉnh sửa (Corrected)</span>
              </div>
              <p className="m-0 font-serif text-base leading-relaxed break-words font-semibold">
                <InlineDiff
                  original={originalParagraph}
                  corrected={correctedParagraph}
                  view="corrected"
                />
              </p>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-lg border border-border bg-surface-strong text-text font-serif text-base leading-relaxed">
            {originalParagraph}
            <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded bg-success-light text-success border border-success/20 align-middle">
              ✅ Không phát hiện lỗi
            </span>
          </div>
        )}
      </section>

      <SentenceBreakdownPanel sentenceBreakdowns={sentenceBreakdowns} />
      <SourceMeaningPanel
        mode="grammar"
        lesson={lesson}
        lessonFocuses={lessonFocuses}
      />
    </>
  );
}
