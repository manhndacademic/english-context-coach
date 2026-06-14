"use client";

import { cn } from "@/lib/utils";

interface StreakBadgeProps {
  days: number;
}

export function StreakBadge({ days }: StreakBadgeProps) {
  if (days === 0) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-md bg-surface-strong border border-border text-muted text-sm">
        <span className="text-base grayscale opacity-60">🔥</span>
        <span className="font-medium">Bắt đầu streak hôm nay!</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3.5 py-2.5 rounded-md border text-sm font-semibold",
        "bg-gradient-to-br from-warning-light to-warning-light/60 dark:from-warning/15 dark:to-warning/5",
        "border-warning/30 text-warning dark:text-warning-strong ring-2 ring-warning/5"
      )}
    >
      <span className="text-xl leading-none drop-shadow-[0_0_4px_rgba(249,115,22,0.5)]">
        🔥
      </span>
      <span>
        <strong className="text-[1.05rem] font-bold">{days}</strong> ngày liên
        tục
      </span>
    </div>
  );
}
