import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";

interface DashboardStatsProps {
  dueCount: number;
  patternCount: number;
  masteredCount: number;
  reviewSuccessRate: number;
}

export function DashboardStats({
  dueCount,
  patternCount,
  masteredCount,
  reviewSuccessRate,
}: DashboardStatsProps) {
  return (
    <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-4">
      <h2 className="text-xl font-bold text-text flex items-center gap-2 m-0">
        <Calendar size={18} className="text-muted" /> Hôm nay của bạn
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="hover-lift bg-surface-strong border border-transparent rounded-md p-3.5 grid gap-1">
          <span className="text-muted text-[11px] font-semibold uppercase tracking-wider leading-none">
            Cần ôn tập
          </span>
          <strong
            className={`text-2xl font-bold block leading-tight ${
              dueCount > 0 ? "text-warning" : "text-text"
            }`}
          >
            {dueCount}
          </strong>
        </div>
        <div className="hover-lift bg-surface-strong border border-transparent rounded-md p-3.5 grid gap-1">
          <span className="text-muted text-[11px] font-semibold uppercase tracking-wider leading-none">
            Mẫu lỗi lưu
          </span>
          <strong className="text-2xl font-bold block leading-tight">
            {patternCount}
          </strong>
        </div>
        <div className="hover-lift bg-surface-strong border border-transparent rounded-md p-3.5 grid gap-1">
          <span className="text-muted text-[11px] font-semibold uppercase tracking-wider leading-none">
            Đã thành thạo
          </span>
          <strong className="text-2xl font-bold block leading-tight text-success">
            {masteredCount}
          </strong>
        </div>
        <div className="hover-lift bg-surface-strong border border-transparent rounded-md p-3.5 grid gap-1">
          <span className="text-muted text-[11px] font-semibold uppercase tracking-wider leading-none">
            Tỷ lệ ôn đúng
          </span>
          <strong className="text-2xl font-bold block leading-tight">
            {reviewSuccessRate > 0 ? `${reviewSuccessRate}%` : "—"}
          </strong>
        </div>
      </div>
      {dueCount === 0 && (
        <Link
          className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-transparent px-5 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)] w-full"
          href="/review"
        >
          Bắt đầu ôn tập lỗi <ArrowRight size={14} />
        </Link>
      )}
    </section>
  );
}
