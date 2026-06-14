"use client";

import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import type { CompletionStats } from "./completion-summary-stats";
import { cn } from "@/lib/utils";

interface CompletionSummaryProps {
  stats: CompletionStats;
  onRetry: () => void;
}

export function CompletionSummary({ stats, onRetry }: CompletionSummaryProps) {
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
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(nextReviewAt))
    : null;

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
              ? "bg-success-light text-success border-success/30"
              : score >= 40
                ? "bg-warning-light text-warning border-warning/30"
                : "bg-danger-light text-danger border-danger/30"
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

      {/* Review schedule note */}
      {savedMistakes > 0 && (
        <p className="text-xs text-muted m-0 bg-surface-strong rounded-md px-3 py-2.5 border border-border">
          📅 Hệ thống đã lưu lỗi của bạn và sẽ nhắc bạn ôn tập lại vào những
          ngày tới.
        </p>
      )}

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {repeatedErrors > 0 && (
          <Link
            href="/review"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-bold no-underline flex-1 transition-all hover:-translate-y-px bg-danger text-white shadow-[0_2px_8px_rgba(220,38,38,0.25)]"
          >
            <RefreshCw size={14} /> Ôn tập lỗi lặp lại
          </Link>
        )}
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-bold no-underline flex-1 transition-all hover:-translate-y-px bg-accent text-white shadow-[0_2px_8px_rgba(5,150,105,0.25)]"
        >
          Học bài mới <ArrowRight size={14} />
        </Link>
        <button
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold transition-all hover:-translate-y-px flex-1 bg-surface-strong text-text border border-border"
        >
          <RotateCcw size={14} /> Làm lại
        </button>
      </div>
    </div>
  );
}
