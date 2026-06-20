"use client";

import { useState, useEffect } from "react";
import { renderRichText } from "@/lib/rich-text";
import { InlineDiff } from "./InlineDiff";
import type { DiffSpan } from "@/domain/lesson/schemas";
import type { LessonViewMode, DiffViewMode } from "@/domain/types";

interface SentenceBreakdownItem {
  id: string;
  sentence: string;
  correctedSentenceEn: string | null;
  diffSpans?: DiffSpan[] | null;
  naturalMeaningVi: string;
  structureNotesVi: string;
  toneOrContextVi: string | null;
  ipa?: string | null;
}

interface SentenceBreakdownPanelProps {
  sentenceBreakdowns: SentenceBreakdownItem[];
  /** "grammar" = correction comparison view (default); "standard" = clean analysis without comparison */
  mode?: LessonViewMode;
}

export function SentenceBreakdownPanel({
  sentenceBreakdowns,
  mode = "grammar",
}: SentenceBreakdownPanelProps) {
  const [viewMode, setViewMode] = useState<DiffViewMode>("unified");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sentence-diff-view-mode");
      if (saved === "unified" || saved === "split") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setViewMode(saved);
      }
    }
  }, []);

  const handleViewModeChange = (newMode: DiffViewMode) => {
    setViewMode(newMode);
    localStorage.setItem("sentence-diff-view-mode", newMode);
  };

  if (!sentenceBreakdowns.length) return null;

  if (mode === "standard") {
    return (
      <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-text m-0">Phân tích câu</h2>
            <p className="text-xs text-muted leading-relaxed m-0 mt-1">
              Giải nghĩa từng câu để hiểu đúng nghĩa tự nhiên và cấu trúc trong
              ngữ cảnh.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-extrabold uppercase bg-accent-light text-accent border border-accent/10 hover:bg-accent-light/20 transition-all cursor-pointer select-none"
          >
            {isOpen ? "Thu gọn ⌃" : "Xem chi tiết ⌄"}
          </button>
        </div>

        {isOpen && (
          <div className="grid gap-4 border-t border-border pt-5 animate-in fade-in duration-200">
            {sentenceBreakdowns.map((breakdown, idx) => (
              <div
                key={breakdown.id}
                className="border border-border rounded-md overflow-hidden bg-surface"
              >
                {/* Sentence quote */}
                <div className="px-5 py-4 bg-surface-strong border-b border-border flex items-start gap-3">
                  <span className="text-accent font-black text-lg leading-none mt-0.5 shrink-0 select-none">
                    {idx + 1}
                  </span>
                  <div className="grid gap-1">
                    <p className="m-0 font-serif text-base leading-relaxed text-text">
                      {breakdown.sentence}
                    </p>
                    {breakdown.ipa && (
                      <span className="font-sans text-xs text-muted/80 italic select-all block mt-0.5">
                        /{breakdown.ipa}/
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 sm:p-5 grid gap-3.5">
                  <div>
                    <strong className="text-[11px] font-bold uppercase text-muted tracking-wider block mb-1">
                      Nghĩa tự nhiên:
                    </strong>
                    <div className="text-sm md:text-[15px] font-semibold text-text leading-relaxed">
                      {renderRichText(breakdown.naturalMeaningVi)}
                    </div>
                  </div>

                  {breakdown.structureNotesVi && (
                    <div>
                      <strong className="text-[11px] font-bold uppercase text-muted tracking-wider block mb-1">
                        Lưu ý cấu trúc:
                      </strong>
                      <div className="text-sm leading-relaxed text-text">
                        {renderRichText(breakdown.structureNotesVi)}
                      </div>
                    </div>
                  )}

                  {breakdown.toneOrContextVi ? (
                    <div>
                      <strong className="text-[11px] font-bold uppercase text-muted tracking-wider block mb-1">
                        Sắc thái / Ngữ cảnh:
                      </strong>
                      <div className="text-sm leading-relaxed text-muted">
                        {renderRichText(breakdown.toneOrContextVi)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  // Grammar correction comparison view (default)
  return (
    <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <h2 className="text-2xl font-bold text-text m-0">
            So sánh sửa lỗi (Grammar &amp; Style Corrections)
          </h2>
          <p className="text-xs text-muted leading-relaxed m-0 mt-1">
            So sánh trực quan giữa văn bản gốc của bạn và đề xuất chỉnh sửa tự
            nhiên hơn.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {isOpen && (
            <div className="flex items-center gap-1 bg-surface-strong border border-border p-1 rounded-lg select-none">
              <button
                type="button"
                onClick={() => handleViewModeChange("unified")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === "unified"
                    ? "bg-surface text-accent shadow-sm border border-border/10"
                    : "text-muted hover:text-text"
                }`}
              >
                Xem inline
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange("split")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === "split"
                    ? "bg-surface text-accent shadow-sm border border-border/10"
                    : "text-muted hover:text-text"
                }`}
              >
                2 cột
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-extrabold uppercase bg-accent-light text-accent border border-accent/10 hover:bg-accent-light/20 transition-all cursor-pointer select-none"
          >
            {isOpen ? "Thu gọn ⌃" : "Xem chi tiết ⌄"}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="grid gap-5 border-t border-border pt-5 animate-in fade-in duration-200">
          {sentenceBreakdowns.map((breakdown) => {
            const hasCorrection =
              breakdown.correctedSentenceEn &&
              breakdown.correctedSentenceEn.trim() !==
                breakdown.sentence.trim();

            return (
              <div
                key={breakdown.id}
                className="border border-border rounded-md overflow-hidden bg-surface"
              >
                {hasCorrection ? (
                  viewMode === "split" ? (
                    /* Two-column diff view */
                    <div className="grid grid-cols-1 min-[580px]:grid-cols-2 border-b border-border bg-surface-strong">
                      <div className="p-4 border-r border-border bg-danger-light text-danger">
                        <div className="text-[11px] font-bold uppercase mb-2">
                          Bản gốc (Original)
                        </div>
                        <p className="m-0">
                          <InlineDiff
                            original={breakdown.sentence}
                            corrected={breakdown.correctedSentenceEn}
                            diffSpans={breakdown.diffSpans}
                            view="original"
                          />
                        </p>
                      </div>

                      <div className="p-4 bg-success-light text-success">
                        <div className="text-[11px] font-bold uppercase mb-2">
                          Bản sửa đổi (Corrected)
                        </div>
                        <p className="m-0 font-bold">
                          <InlineDiff
                            original={breakdown.sentence}
                            corrected={breakdown.correctedSentenceEn}
                            diffSpans={breakdown.diffSpans}
                            view="corrected"
                          />
                        </p>
                        {breakdown.ipa && (
                          <span className="font-sans text-xs text-success-strong/80 block mt-1 select-all font-normal">
                            /{breakdown.ipa}/
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Unified inline diff view */
                    <div className="p-4 border-b border-border bg-surface-strong">
                      <div className="text-[11px] font-bold uppercase mb-2 text-muted">
                        Câu sửa lỗi (Unified Diff)
                      </div>
                      <p className="m-0 leading-relaxed font-serif">
                        <InlineDiff
                          original={breakdown.sentence}
                          corrected={breakdown.correctedSentenceEn}
                          diffSpans={breakdown.diffSpans}
                          view="unified"
                        />
                      </p>
                      {breakdown.ipa && (
                        <span className="font-sans text-xs text-muted block mt-1 select-all font-normal">
                          /{breakdown.ipa}/
                        </span>
                      )}
                    </div>
                  )
                ) : (
                  /* No-error single row */
                  <div className="p-4 border-b border-border bg-surface-strong flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <InlineDiff
                        original={breakdown.sentence}
                        corrected={breakdown.correctedSentenceEn}
                        diffSpans={breakdown.diffSpans}
                      />
                    </div>
                    {breakdown.ipa && (
                      <span className="font-sans text-xs text-muted select-all block mt-0.5">
                        /{breakdown.ipa}/
                      </span>
                    )}
                  </div>
                )}

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
            );
          })}
        </div>
      )}
    </section>
  );
}
