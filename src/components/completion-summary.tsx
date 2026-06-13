"use client";

import Link from "next/link";
import { CheckCircle2, XCircle, RefreshCw, ArrowRight, RotateCcw } from "lucide-react";

export interface CompletionStats {
  total: number;
  correctFirstTry: number;
  repeatedErrors: number;
}

interface CompletionSummaryProps {
  stats: CompletionStats;
  onRetry: () => void;
}

export function CompletionSummary({ stats, onRetry }: CompletionSummaryProps) {
  const { total, correctFirstTry, repeatedErrors } = stats;
  const score = total > 0 ? Math.round((correctFirstTry / total) * 100) : 0;
  const isPerfect = correctFirstTry === total;

  return (
    <div
      className="rounded-lg border p-6 flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{
        background: isPerfect
          ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
          : "var(--surface)",
        borderColor: isPerfect ? "#86efac" : "var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-xl font-black"
          style={{
            background: score >= 70 ? "#dcfce7" : score >= 40 ? "#fef9c3" : "#fee2e2",
            color: score >= 70 ? "#16a34a" : score >= 40 ? "#ca8a04" : "#dc2626",
            border: `2px solid ${score >= 70 ? "#86efac" : score >= 40 ? "#fde047" : "#fca5a5"}`,
          }}
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
            <span className="text-xs text-muted block leading-none mb-0.5">Đúng ngay lần đầu</span>
            <strong className="text-text font-bold">
              {correctFirstTry}/{total} bài tập
            </strong>
          </div>
        </div>

        {repeatedErrors > 0 ? (
          <div className="flex items-center gap-2.5 bg-[#fff5f4] rounded-md p-3 border border-[#f2b8b5]">
            <RefreshCw size={16} className="text-danger shrink-0" />
            <div>
              <span className="text-xs text-muted block leading-none mb-0.5">Lỗi lặp lại</span>
              <strong className="text-danger font-bold">{repeatedErrors} mẫu lỗi</strong>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 bg-surface-strong rounded-md p-3 border border-border">
            <XCircle size={16} className="text-muted shrink-0" />
            <div>
              <span className="text-xs text-muted block leading-none mb-0.5">Sai</span>
              <strong className="text-text font-bold">
                {total - correctFirstTry} bài tập
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* Review schedule note */}
      {total - correctFirstTry > 0 && (
        <p className="text-xs text-muted m-0 bg-surface-strong rounded-md px-3 py-2.5 border border-border">
          📅 Hệ thống đã lưu lỗi của bạn và sẽ nhắc bạn ôn tập lại vào những ngày tới.
        </p>
      )}

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {repeatedErrors > 0 && (
          <Link
            href="/review"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-bold no-underline flex-1 transition-all hover:-translate-y-px"
            style={{
              background: "var(--danger)",
              color: "white",
              boxShadow: "0 2px 8px rgba(220,38,38,0.25)",
            }}
          >
            <RefreshCw size={14} /> Ôn tập lỗi lặp lại
          </Link>
        )}
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-bold no-underline flex-1 transition-all hover:-translate-y-px"
          style={{
            background: "var(--accent)",
            color: "white",
            boxShadow: "0 2px 8px rgba(5,150,105,0.25)",
          }}
        >
          Học bài mới <ArrowRight size={14} />
        </Link>
        <button
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold transition-all hover:-translate-y-px flex-1"
          style={{
            background: "var(--surface-strong)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          <RotateCcw size={14} /> Làm lại
        </button>
      </div>
    </div>
  );
}
