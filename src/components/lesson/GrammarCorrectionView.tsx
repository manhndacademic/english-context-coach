import { SentenceBreakdownPanel } from "./SentenceBreakdownPanel";
import { SourceMeaningPanel } from "./SourceMeaningPanel";
import { InlineDiff } from "./InlineDiff";
import { ReadableSourceText } from "@/components/readable-source-text";
import type { DiffSpan } from "@/domain/lesson/schemas";
import type { KeyPhrase } from "@/domain/lesson";

interface GrammarCorrectionViewProps {
  lesson: {
    id: string;
    summaryVi: string | null;
    naturalTranslationVi: string | null;
    contextExplanationVi: string | null;
  };
  sourceContent: string | null;
  phrases: KeyPhrase[];
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
  sourceContent,
  phrases,
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

      {/* Raw Original Source Text Section */}
      {sourceContent ? (
        <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
          <div className="flex flex-col min-[860px]:flex-row min-[860px]:items-baseline gap-2">
            <h2 className="text-2xl font-bold text-text m-0">
              Văn bản gốc ban đầu (Original Source)
            </h2>
            <span className="text-xs text-muted">
              Nhấp vào từ/cụm từ tô màu để xem giải nghĩa bên phải.
            </span>
          </div>
          <div className="border border-border rounded-md p-6 bg-surface font-serif text-[17px] md:text-lg leading-relaxed overflow-y-auto max-h-[340px] min-[860px]:max-h-[500px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.03)] text-text space-y-3 [&_h3]:text-lg [&_h3]:font-bold [&_blockquote]:border-l-3 [&_blockquote]:border-accent [&_blockquote]:pl-3.5 [&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:list-disc [&_ol]:list-decimal [&_pre]:overflow-auto [&_pre]:border [&_pre]:border-border [&_pre]:rounded-md [&_pre]:bg-surface-strong [&_pre]:p-3 [&_pre]:whitespace-pre-wrap">
            <ReadableSourceText
              key={`${lesson.id}-${phrases.map((p) => p.id).join(",")}`}
              doc={sourceContent}
              phrases={phrases}
            />
          </div>
        </section>
      ) : null}

      <SentenceBreakdownPanel sentenceBreakdowns={sentenceBreakdowns} />
      <SourceMeaningPanel
        mode="grammar"
        lesson={lesson}
        lessonFocuses={lessonFocuses}
      />
    </>
  );
}
