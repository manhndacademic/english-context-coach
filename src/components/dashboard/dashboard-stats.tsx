import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";

interface DashboardStatsProps {
  dueCount: number;
  patternCount: number;
  masteredCount: number;
  reviewSuccessRate: number;
  exercisesCompleted?: number;
  lessonsCompleted?: number;
}

export function DashboardStats({
  dueCount,
  patternCount,
  masteredCount,
  reviewSuccessRate,
  exercisesCompleted = 0,
  lessonsCompleted = 0,
}: DashboardStatsProps) {
  return (
    <SectionCard className="p-5 sm:p-8 gap-4">
      <SectionCard.Header
        title="Hôm nay của bạn"
        icon={<Calendar size={18} className="text-muted" />}
      />
      <SectionCard.Body className="gap-4">
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard
            label="Cần ôn tập"
            value={dueCount}
            valueVariant={dueCount > 0 ? "warning" : "default"}
          />
          <StatCard label="Mẫu lỗi lưu" value={patternCount} />
          <StatCard
            label="Đã thành thạo"
            value={masteredCount}
            valueVariant="success"
          />
          <StatCard
            label="Tỷ lệ ôn đúng"
            value={reviewSuccessRate > 0 ? `${reviewSuccessRate}%` : "—"}
          />
          <StatCard
            label="Luyện tập đúng"
            value={exercisesCompleted}
            valueVariant="accent"
          />
          <StatCard label="Bài học đã học" value={lessonsCompleted} />
        </div>
        {dueCount === 0 && (
          <Button asChild className="w-full">
            <Link href="/review">
              Bắt đầu ôn tập lỗi <ArrowRight size={14} />
            </Link>
          </Button>
        )}
      </SectionCard.Body>
    </SectionCard>
  );
}
