interface CorrectionCardProps {
  item: {
    id: string;
    category: string;
    errorType: string;
    draftPhrase: string;
    correctedPhrase: string;
    explanationVi: string;
    literalTrapVi?: string | null;
    culturalNoteVi?: string | null;
    exampleEn?: string | null;
    exampleVi?: string | null;
  };
}

export function CorrectionCard({ item }: CorrectionCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 shadow-sm hover-shadow-accent transition-all relative overflow-hidden grid gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold tracking-wider uppercase bg-surface-strong border border-border text-text px-2 py-0.5 rounded">
            {item.category.replace(/_/g, " ")}
          </span>
          <span className="text-[10px] font-bold tracking-wider uppercase bg-danger-light text-danger-strong px-2 py-0.5 rounded border border-danger/10">
            {item.errorType.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 bg-surface-strong/50 border border-border/40 rounded-md p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-danger line-through font-serif text-base font-semibold">
            {item.draftPhrase}
          </span>
          <span className="text-muted font-serif">➔</span>
          <span className="text-success font-serif text-lg font-bold">
            {item.correctedPhrase}
          </span>
        </div>
      </div>

      <div className="grid gap-3 text-sm">
        <div className="text-text leading-relaxed">
          <strong>Giải thích:</strong> {item.explanationVi}
        </div>

        {item.literalTrapVi && (
          <div className="bg-warning-light border-l-4 border-warning p-3 rounded-r-md text-text">
            <span className="font-bold text-warning-strong">
              ⚠️ Bẫy dịch từng từ:
            </span>{" "}
            {item.literalTrapVi}
          </div>
        )}

        {item.culturalNoteVi && (
          <div className="bg-accent-light border-l-4 border-accent p-3 rounded-r-md text-text">
            <span className="font-bold text-accent-strong flex items-center gap-1 mb-1 text-xs">
              🌏 Lưu ý bối cảnh & văn hóa:
            </span>{" "}
            {item.culturalNoteVi}
          </div>
        )}

        {item.exampleEn && (
          <div className="border-t border-border/60 pt-3 mt-1">
            <span className="text-xs text-muted block mb-1">
              Ví dụ tương tự:
            </span>
            <div className="font-serif italic text-text text-base">
              &ldquo;{item.exampleEn}&rdquo;
            </div>
            {item.exampleVi && (
              <div className="text-muted text-sm mt-0.5">
                ({item.exampleVi})
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
