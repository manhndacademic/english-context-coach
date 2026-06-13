import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";

interface ReviewNudgeProps {
  count: number;
}

export function ReviewNudge({ count }: ReviewNudgeProps) {
  if (count === 0) return null;

  return (
    <div
      className="rounded-lg p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap border border-accent/35 bg-gradient-to-br from-accent-light to-accent-light/40 shadow-sm"
      style={{
        animation: "nudge-pulse 3s ease-in-out infinite",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="p-2.5 rounded-md shrink-0"
          style={{ background: "rgba(5,150,105,0.15)", color: "var(--accent)" }}
        >
          <BookOpen size={20} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm m-0" style={{ color: "var(--accent-strong)" }}>
            Bạn có {count} mẫu lỗi cần ôn tập
          </p>
          <p className="text-xs m-0 mt-0.5" style={{ color: "var(--accent)" }}>
            Ôn tập ngay để không quên kiến thức đã học
          </p>
        </div>
      </div>
      <Link
        href="/review"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold no-underline shrink-0 transition-all hover:-translate-y-px"
        style={{
          background: "var(--accent)",
          color: "white",
          boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
        }}
      >
        Ôn tập ngay <ArrowRight size={14} />
      </Link>
    </div>
  );
}
