import { renderRichText } from "@/lib/rich-text";

interface SentenceBreakdownPanelProps {
  sentenceBreakdowns: Array<{
    id: string;
    sentence: string;
    correctedSentenceEn: string | null;
    naturalMeaningVi: string;
    structureNotesVi: string;
    toneOrContextVi: string | null;
  }>;
}

export function SentenceBreakdownPanel({
  sentenceBreakdowns,
}: SentenceBreakdownPanelProps) {
  if (!sentenceBreakdowns.length) return null;

  return (
    <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
      <h2 className="text-2xl font-bold text-text m-0">
        So sánh sửa lỗi (Grammar & Style Corrections)
      </h2>
      <p className="text-xs text-muted leading-relaxed m-0 -mt-2">
        So sánh trực quan giữa văn bản gốc của bạn và đề xuất chỉnh sửa tự nhiên
        hơn.
      </p>

      <div className="grid gap-5">
        {sentenceBreakdowns.map((breakdown) => (
          <div
            key={breakdown.id}
            className="border border-border rounded-md overflow-hidden bg-surface"
          >
            <div className="grid grid-cols-1 min-[580px]:grid-cols-2 border-b border-border bg-surface-strong">
              <div className="p-4 border-r border-border bg-danger-light text-danger">
                <div className="text-[11px] font-bold uppercase mb-2">
                  Bản gốc (Original)
                </div>
                <p className="m-0 line-through font-serif text-base leading-relaxed">
                  {breakdown.sentence}
                </p>
              </div>

              <div className="p-4 bg-success-light text-success">
                <div className="text-[11px] font-bold uppercase mb-2">
                  Bản sửa đổi (Corrected)
                </div>
                <p className="m-0 font-serif text-base font-bold leading-relaxed">
                  {breakdown.correctedSentenceEn || breakdown.sentence}
                </p>
              </div>
            </div>

            <div className="p-4 grid gap-3">
              <div>
                <strong className="text-[11px] font-bold uppercase text-muted tracking-wider block">
                  Dịch nghĩa tự nhiên:
                </strong>
                <div className="m-0 mt-1 text-sm md:text-[15px] font-semibold text-text">
                  {renderRichText(breakdown.naturalMeaningVi)}
                </div>
              </div>
              <div>
                <strong className="text-[11px] font-bold uppercase text-muted tracking-wider block">
                  Giải thích chi tiết:
                </strong>
                <div className="m-0 mt-1 text-sm leading-relaxed text-text">
                  {renderRichText(breakdown.structureNotesVi)}
                </div>
              </div>
              {breakdown.toneOrContextVi ? (
                <div>
                  <strong className="text-[11px] font-bold uppercase text-muted tracking-wider block">
                    Sắc thái / Ngữ cảnh:
                  </strong>
                  <div className="m-0 mt-1 text-sm leading-relaxed text-muted">
                    {renderRichText(breakdown.toneOrContextVi)}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
