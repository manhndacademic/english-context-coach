"use client";

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
      className="flex items-center gap-2 px-3.5 py-2.5 rounded-md border text-sm font-semibold"
      style={{
        background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)",
        borderColor: "#f97316",
        color: "#c2410c",
        boxShadow: "0 0 0 2px rgba(249,115,22,0.12)",
      }}
    >
      <span
        className="text-xl leading-none"
        style={{ filter: "drop-shadow(0 0 4px rgba(249,115,22,0.5))" }}
      >
        🔥
      </span>
      <span>
        <strong style={{ fontSize: "1.05rem" }}>{days}</strong> ngày liên tục
      </span>
    </div>
  );
}
