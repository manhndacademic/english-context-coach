"use client";

import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import type { CompletionStats, PracticeLike } from "./completion-summary-stats";
import { cn } from "@/lib/utils";

const viDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

interface CompletionSummaryProps {
  stats: CompletionStats;
  practices?: PracticeLike[];
  onRetry: () => void;
  correctionItems?: any[];
}

const DEFAULT_PRACTICES: PracticeLike[] = [];
const DEFAULT_CORRECTION_ITEMS: any[] = [];

export function CompletionSummary({
  stats,
  practices = DEFAULT_PRACTICES,
  onRetry,
  correctionItems = DEFAULT_CORRECTION_ITEMS,
}: CompletionSummaryProps) {
  const {
    total,
    correctFirstTry,
    newMistakesSaved,
    repeatedErrors,
    nextReviewAt,
  } = stats;
  const score = total > 0 ? Math.round((correctFirstTry / total) * 100) : 0;
  const isPerfect = correctFirstTry === total;
  const savedMistakes = newMistakesSaved + repeatedErrors;
  const nextReviewLabel = nextReviewAt
    ? viDateTimeFormatter.format(new Date(nextReviewAt))
    : null;

  // Get unique updated patterns
  const errors = practices.map((p) => p.userError).filter(Boolean);
  const uniqueErrors = Array.from(
    new Map(errors.map((err) => [err!.conceptKey, err])).values()
  );

  return (
    <div
      className={cn(
        "rounded-lg border p-6 flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300",
        isPerfect
          ? "bg-gradient-to-br from-success-light to-success-light/40 border-success/30"
          : "bg-surface border-border"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-xl font-black border-2",
            score >= 70
              ? "bg-success-light text-success-strong border-success/30"
              : score >= 40
                ? "bg-warning-light text-warning-strong border-warning/30"
                : "bg-danger-light text-danger-strong border-danger/30"
          )}
        >
          {score}%
        </div>
        <div>
          <h3 className="text-lg font-bold text-text m-0">
            {isPerfect ? "🎉 Tuyệt vời!" : "🎯 Kết quả học tập"}
          </h3>
          <p className="text-sm text-muted m-0">
            {isPerfect
              ? "Bạn đã trả lời đúng tất cả bài tập!"
              : "Hoàn thành bài học. Dưới đây là kết quả của bạn."}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2.5 bg-surface-strong rounded-md p-3 border border-border">
          <CheckCircle2 size={16} className="text-success shrink-0" />
          <div>
            <span className="text-xs text-muted block leading-none mb-0.5">
              Đúng ngay lần đầu
            </span>
            <strong className="text-text font-bold">
              {correctFirstTry}/{total} bài tập
            </strong>
          </div>
        </div>

        {savedMistakes > 0 ? (
          <div className="flex items-center gap-2.5 bg-[#fff5f4] rounded-md p-3 border border-[#f2b8b5]">
            <RefreshCw size={16} className="text-danger shrink-0" />
            <div>
              <span className="text-xs text-muted block leading-none mb-0.5">
                Lỗi đã lưu
              </span>
              <strong className="text-danger font-bold">
                {savedMistakes} mẫu lỗi
              </strong>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 bg-surface-strong rounded-md p-3 border border-border">
            <XCircle size={16} className="text-muted shrink-0" />
            <div>
              <span className="text-xs text-muted block leading-none mb-0.5">
                Sai
              </span>
              <strong className="text-text font-bold">
                {total - correctFirstTry} bài tập
              </strong>
            </div>
          </div>
        )}
      </div>

      {savedMistakes > 0 ? (
        <div className="grid gap-2 bg-surface-strong rounded-md px-3 py-2.5 border border-border text-xs text-muted">
          <span>
            Lỗi mới: <strong className="text-text">{newMistakesSaved}</strong> ·
            Lỗi lặp lại: <strong className="text-text">{repeatedErrors}</strong>
          </span>
          {nextReviewLabel ? (
            <span>
              Lần ôn gần nhất:{" "}
              <strong className="text-text">{nextReviewLabel}</strong>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* CorrectionItems Summary for diff lessons */}
      {correctionItems && correctionItems.length > 0 ? (
        <div className="bg-surface border border-border/80 rounded-lg p-4 grid gap-3 mt-1 text-left">
          <h4 className="text-xs font-black uppercase text-muted tracking-wider m-0 flex items-center gap-1.5">
            📝 Kết quả sửa lỗi (Correction Summary)
          </h4>
          <div className="grid gap-2.5">
            {correctionItems.map((item) => {
              const hasMistake = practices.some(
                (p) => p.exercise?.correctionItemId === item.id && p.userError
              );

              return (
                <div
                  key={item.id}
                  className="bg-surface-strong border border-border rounded-md p-3 text-xs grid gap-1.5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono bg-danger-light text-danger-strong border border-danger/10 px-1.5 py-0.5 rounded line-through decoration-danger">
                        {item.draftPhrase}
                      </span>
                      <span className="text-muted">→</span>
                      <span className="font-mono bg-success-light text-success-strong border border-success/10 px-1.5 py-0.5 rounded font-bold">
                        {item.correctedPhrase}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold border uppercase",
                        hasMistake
                          ? "bg-warning-light text-warning border-warning/15"
                          : "bg-success-light text-success border-success/15"
                      )}
                    >
                      {hasMistake ? "Cần luyện thêm" : "Đã thuộc"}
                    </span>
                  </div>
                  {item.explanationVi && (
                    <p className="text-muted m-0 leading-relaxed font-medium mt-1">
                      {item.explanationVi}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Mastery Progress Preview for standard lessons */
        uniqueErrors.length > 0 && (
          <div className="bg-surface border border-border/80 rounded-lg p-4 grid gap-3 mt-1 text-left">
            <h4 className="text-xs font-black uppercase text-muted tracking-wider m-0 flex items-center gap-1.5">
              🎯 Cập nhật sổ tay lỗi (Error Memory)
            </h4>
            <div className="grid gap-2.5">
              {uniqueErrors.map((err) => (
                <div
                  key={err!.conceptKey}
                  className="bg-surface-strong border border-border rounded-md p-3 text-xs grid gap-1.5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <code className="text-accent font-extrabold px-1.5 py-0.5 rounded bg-accent-light border border-accent/10 font-mono">
                      {err!.conceptKey}
                    </code>
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold border uppercase",
                        err!.isRepeated
                          ? "bg-danger-light text-danger border-danger/15"
                          : "bg-info-light text-info border-info/15"
                      )}
                    >
                      {err!.isRepeated ? "Lặp lại" : "Mới phát hiện"}
                    </span>
                  </div>
                  {err!.explanationVi && (
                    <p className="text-muted m-0 leading-relaxed font-medium">
                      {err!.explanationVi}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Review schedule note */}
      {savedMistakes > 0 && (
        <p className="text-xs text-muted m-0 bg-surface-strong rounded-md px-3 py-2.5 border border-border text-left">
          📅 Hệ thống đã lưu lỗi của bạn và sẽ nhắc bạn ôn tập lại vào những
          ngày tới.
        </p>
      )}

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {repeatedErrors > 0 ? (
          <Link
            href="/review"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-bold no-underline flex-[2] transition-all hover:-translate-y-px bg-danger text-white shadow-[0_2px_8px_rgba(220,38,38,0.25)] hover:bg-danger-hover text-center cursor-pointer"
          >
            <RefreshCw size={14} /> Ôn tập lỗi lặp lại ngay
          </Link>
        ) : (
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-bold no-underline flex-[2] transition-all hover:-translate-y-px bg-accent text-white shadow-[0_2px_8px_rgba(5,150,105,0.25)] hover:bg-accent-hover text-center cursor-pointer"
          >
            Học bài mới <ArrowRight size={14} />
          </Link>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold transition-all hover:-translate-y-px flex-1 bg-surface-strong text-text border border-border cursor-pointer"
        >
          <RotateCcw size={14} /> Làm lại
        </button>
      </div>
    </div>
  );
}
