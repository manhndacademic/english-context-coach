"use client";

import { AlertTriangle, History } from "lucide-react";

interface RepeatedMistakeBannerProps {
  repeatedMistakes: Array<{
    item: {
      draftPhrase: string;
      correctedPhrase: string;
    };
    pattern: {
      occurrenceCount: number;
    };
  }>;
}

export function RepeatedMistakeBanner({
  repeatedMistakes,
}: RepeatedMistakeBannerProps) {
  if (!repeatedMistakes.length) return null;

  return (
    <div className="border border-warning/35 bg-gradient-to-br from-warning-light to-warning-light/40 dark:from-warning-light/10 dark:to-warning-light/5 text-warning-strong rounded-xl p-5 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm">
      <div className="flex items-center gap-2.5 text-warning font-bold text-base">
        <AlertTriangle size={20} className="shrink-0 animate-bounce" />
        <h3 className="m-0 font-bold text-warning-strong">
          Phát hiện lỗi lặp lại (Repeated Mistakes Detected)
        </h3>
      </div>
      <p className="text-sm m-0 text-muted leading-relaxed">
        Bạn đã lặp lại các lỗi sau đây từ những bài học hoặc văn bản trước đó.
        Hãy lưu ý kỹ để tránh bẫy dịch từng từ (word-by-word) trong phần thực
        hành nhé!
      </p>
      <div className="flex flex-col gap-2 mt-1">
        {repeatedMistakes.map(({ item, pattern }, idx) => (
          <div
            key={idx}
            className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-surface border border-border text-sm"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono bg-danger-light text-danger-strong border border-danger/10 px-2 py-0.5 rounded line-through decoration-danger">
                {item.draftPhrase}
              </span>
              <span className="text-muted">→</span>
              <span className="font-mono bg-success-light text-success-strong border border-success/10 px-2 py-0.5 rounded font-bold">
                {item.correctedPhrase}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-muted bg-surface-strong px-2 py-1 rounded-md border border-border">
              <History size={12} /> Đã gặp {pattern.occurrenceCount} lần trước
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
