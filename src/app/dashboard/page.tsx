import React from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { SourceTextForm } from "@/components/source-text-form";
import { getLessonRepository } from "@/domain/lesson";
import { getLearnerMemoryEngine } from "@/domain/memory";
import { StreakBadge } from "@/components/dashboard/streak-badge";
import { ReviewNudge } from "@/components/dashboard/review-nudge";
import { LessonCard } from "@/components/dashboard/lesson-card";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { RepeatedMistakesPanel } from "@/components/dashboard/repeated-mistakes-panel";
import dynamic from "next/dynamic";
import { Sparkles, BookOpen, TrendingUp } from "lucide-react";

const MasteredTrendChart = dynamic(
  () =>
    import("@/components/dashboard/mastered-trend-chart").then(
      (mod) => mod.MasteredTrendChart
    ),
  {
    loading: () => (
      <div className="w-full h-45 bg-surface-strong/10 animate-pulse rounded-md" />
    ),
  }
);

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();

  const lessonRepo = getLessonRepository();
  const memoryEngine = getLearnerMemoryEngine();

  const [recentLessons, sourceCount, dashboardMetrics] = await Promise.all([
    lessonRepo.getRecentLessons(user.id, 6),
    lessonRepo.getSourceTextsCount(user.id),
    memoryEngine.getDashboardMetrics(user.id, now),
  ]);

  const {
    dueCount,
    patternCount,
    repeatedMistakes,
    learningStreakDays: streakDays,
    masteredCount,
    reviewSuccessRate,
    masteredTrend,
  } = dashboardMetrics;

  return (
    <main className="max-w-275 mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
      <AppHeader email={user.email} isAdmin={user.role === "admin"} />

      <div className="grid grid-cols-1 min-[860px]:grid-cols-[1.4fr_0.8fr] gap-layout-gap items-start">
        <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
          <div className="flex items-start gap-4 flex-col sm:flex-row">
            <div className="bg-accent-light text-accent p-3 rounded-md shrink-0">
              <Sparkles size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-[28px] font-bold font-serif mb-1.5 text-text m-0">
                Hiểu tiếng Anh trong ngữ cảnh
              </h1>
              <p className="text-muted text-sm leading-relaxed m-0">
                Dán văn bản tiếng Anh từ công việc, học tập, tài liệu API, email
                hoặc tin nhắn Slack. Hệ thống sẽ phân tích bẫy dịch từng từ và
                tạo bài học tự động.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-5 mt-1">
            <SourceTextForm />
          </div>
        </section>

        <aside className="grid gap-layout-gap">
          {/* Review Nudge — shown when there are due review items */}
          <ReviewNudge count={dueCount} />

          {/* Learning Streak */}
          <StreakBadge days={streakDays} />

          {/* Spaced Repetition Summary Box */}
          <DashboardStats
            dueCount={dueCount}
            patternCount={patternCount}
            masteredCount={masteredCount}
            reviewSuccessRate={reviewSuccessRate}
          />

          {/* Repeated Mistakes Card */}
          <RepeatedMistakesPanel repeatedMistakes={repeatedMistakes} />
        </aside>
      </div>

      {/* Progress Trend Chart */}
      <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-4">
        <h2 className="text-2xl font-bold text-text flex items-center gap-2.5 m-0">
          <TrendingUp size={20} className="text-muted" /> Tiến bộ theo thời gian
        </h2>
        <p className="text-muted text-sm m-0 -mt-2">
          North Star: số mẫu lỗi lặp lại đã thành thạo tích lũy theo tuần
        </p>
        <MasteredTrendChart data={masteredTrend} />
      </section>

      {/* Recent Lessons Section */}
      <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-4.5">
        <h2 className="text-2xl font-bold text-text flex items-center gap-2.5 m-0">
          <BookOpen size={20} className="text-muted" /> Các bài học gần đây
        </h2>
        <div className="grid gap-4">
          {recentLessons.length ? (
            recentLessons.map((lesson) => (
              <LessonCard lesson={lesson} key={lesson.id} />
            ))
          ) : (
            <p className="text-muted text-sm leading-relaxed m-0">
              Chưa có bài học nào. Hãy dán một đoạn văn bản tiếng Anh ở trên để
              bắt đầu bài học đầu tiên.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
