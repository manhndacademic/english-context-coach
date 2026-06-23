import { useState } from "react";
import { updateCorrectionPhraseAction } from "@/app/actions/source-texts";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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
  lessonId: string;
  isRejected: boolean;
  onToggleReject: (id: string) => Promise<void> | void;
}

export function CorrectionCard({
  item,
  lessonId,
  isRejected,
  onToggleReject,
}: CorrectionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditValue(item.correctedPhrase);
    setValidationError(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
    setValidationError(null);
  };

  const handleSaveEdit = async () => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setValidationError("Cụm từ sửa không được để trống.");
      return;
    }
    if (trimmed === item.draftPhrase) {
      setValidationError("Cụm từ sửa mới không được trùng với cụm từ nháp cũ.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateCorrectionPhraseAction({
        lessonId,
        correctionItemId: item.id,
        newPhrase: trimmed,
      });

      if (result && result.error) {
        setValidationError(result.error);
      } else {
        setIsEditing(false);
        window.location.reload();
      }
    } catch (err: any) {
      setValidationError(err.message || "Đã xảy ra lỗi.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={`bg-surface border border-border rounded-lg p-5 shadow-sm hover-shadow-accent transition-all relative overflow-hidden grid gap-4 ${
        isRejected
          ? "opacity-60 bg-surface-strong/30 border-dashed border-border/85"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold tracking-wider uppercase bg-surface-strong border border-border text-text px-2 py-0.5 rounded">
            {item.category.replace(/_/g, " ")}
          </span>
          <span className="text-[10px] font-bold tracking-wider uppercase bg-danger-light text-danger-strong px-2 py-0.5 rounded border border-danger/10">
            {item.errorType.replace(/_/g, " ")}
          </span>
          {isRejected && (
            <span className="text-[10px] font-bold tracking-wider uppercase bg-muted/20 text-muted border border-muted/30 px-2 py-0.5 rounded">
              💡 Tham khảo
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onToggleReject(item.id)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all border cursor-pointer select-none ${
            isRejected
              ? "bg-muted/10 text-muted border-muted/20 hover:bg-muted/20"
              : "bg-accent-light text-accent border-accent/20 hover:bg-accent/25"
          }`}
        >
          {isRejected ? "↩️ Giữ bản gốc" : "✅ Đồng ý sửa"}
        </button>
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2 bg-surface-strong/50 border border-border/40 rounded-md p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-danger line-through font-serif text-base font-semibold">
              {item.draftPhrase}
            </span>
            <span className="text-muted font-serif">➔</span>
            <input
              type="text"
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value);
                setValidationError(null);
              }}
              className="flex-1 bg-surface border border-border rounded px-2.5 py-1 text-base font-bold text-success focus:outline-none focus:border-success"
              disabled={isSaving}
              autoFocus
            />
          </div>
          {validationError && (
            <span className="text-xs text-danger font-semibold">
              {validationError}
            </span>
          )}
          <div className="flex gap-2 justify-end mt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCancelEdit}
              disabled={isSaving}
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="bg-success text-white hover:bg-success/95"
            >
              {isSaving && <Loader2 size={12} className="animate-spin mr-1" />}
              Lưu
            </Button>
          </div>
        </div>
      ) : (
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
          {!isRejected && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="p-1 text-muted hover:text-text rounded hover:bg-surface-strong transition-all cursor-pointer text-xs"
              title="Sửa cụm từ"
            >
              ✏️
            </button>
          )}
        </div>
      )}

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
