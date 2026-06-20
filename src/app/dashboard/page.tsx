import { requireUser } from "@/lib/auth/guards";
import { SourceTextForm } from "@/components/source-text-form";
import { getLessonRepository } from "@/domain/lesson";
import {
  getLearnerMemoryEngine,
  getMistakePatternRepository,
} from "@/domain/memory";
import { StreakBadge } from "@/components/dashboard/streak-badge";
import { ReviewNudge } from "@/components/dashboard/review-nudge";
import { LessonCard } from "@/components/dashboard/lesson-card";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { RepeatedMistakesPanel } from "@/components/dashboard/repeated-mistakes-panel";
import { PageLayout } from "@/components/ui/page-layout";
import { SectionCard } from "@/components/ui/section-card";
import dynamic from "next/dynamic";
import { Sparkles, BookOpen, TrendingUp, TrendingDown } from "lucide-react";

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

const LiteralErrorTrendChart = dynamic(
  () =>
    import("@/components/dashboard/literal-error-trend-chart").then(
      (mod) => mod.LiteralErrorTrendChart
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
  const mistakePatternRepo = getMistakePatternRepository();

  const [recentLessons, _, dashboardMetrics, duePatterns] = await Promise.all([
    lessonRepo.getRecentLessons(user.id, 6),
    lessonRepo.getSourceTextsCount(user.id),
    memoryEngine.getDashboardMetrics(user.id, now),
    mistakePatternRepo.findDueMistakePatterns(user.id, now, 1),
  ]);

  const {
    dueCount,
    patternCount,
    repeatedMistakes,
    learningStreakDays: streakDays,
    masteredCount,
    reviewSuccessRate,
    masteredTrend,
    exercisesCompleted,
    lessonsCompleted,
    literalErrorTrend,
  } = dashboardMetrics;

  const firstDuePattern = duePatterns[0]
    ? duePatterns[0].toPlainObject()
    : null;

  return (
    <PageLayout user={user}>
      <div className="flex flex-col gap-layout-gap max-w-5xl mx-auto w-full">
        {/* Top Review Banner */}
        <ReviewNudge count={dueCount} firstDuePattern={firstDuePattern} />

        {/* Middle Progressive Paste Form */}
        <SectionCard>
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
        </SectionCard>

        {/* Bottom Grid for Stats and Info */}
        <div className="grid grid-cols-1 min-[860px]:grid-cols-[1fr_1.2fr] gap-layout-gap items-start">
          {/* Stats, Streak, and Repeated Mistakes */}
          <div className="grid gap-layout-gap w-full">
            <DashboardStats
              dueCount={dueCount}
              patternCount={patternCount}
              masteredCount={masteredCount}
              reviewSuccessRate={reviewSuccessRate}
              exercisesCompleted={exercisesCompleted}
              lessonsCompleted={lessonsCompleted}
            />

            <StreakBadge days={streakDays} />

            <RepeatedMistakesPanel repeatedMistakes={repeatedMistakes} />
          </div>

          {/* Recent Lessons */}
          <div className="w-full">
            <SectionCard className="gap-4.5">
              <SectionCard.Header
                title="Các bài học gần đây"
                icon={<BookOpen size={20} className="text-muted" />}
              />
              <SectionCard.Body className="gap-4">
                {recentLessons.length ? (
                  recentLessons.map((lesson) => (
                    <LessonCard lesson={lesson} key={lesson.id} />
                  ))
                ) : (
                  <p className="text-muted text-sm leading-relaxed m-0">
                    Chưa có bài học nào. Hãy dán một đoạn văn bản tiếng Anh ở
                    trên để bắt đầu bài học đầu tiên.
                  </p>
                )}
              </SectionCard.Body>
            </SectionCard>
          </div>
        </div>

        {/* Progress Trend Charts */}
        <section className="grid grid-cols-1 min-[960px]:grid-cols-2 gap-layout-gap">
          <SectionCard className="gap-4">
            <SectionCard.Header
              title="Thành thạo tích lũy"
              description="Số mẫu lỗi đã thành thạo (mastered) tích lũy theo tuần"
              icon={<TrendingUp size={20} className="text-accent" />}
            />
            <SectionCard.Body>
              <MasteredTrendChart data={masteredTrend} />
            </SectionCard.Body>
          </SectionCard>

          <SectionCard className="gap-4">
            <SectionCard.Header
              title="Tỷ lệ dịch literal"
              description="Tỷ lệ lỗi dịch word-by-word (literal_translation) trên tổng số lỗi theo tuần"
              icon={<TrendingDown size={20} className="text-warning" />}
            />
            <SectionCard.Body>
              <LiteralErrorTrendChart data={literalErrorTrend} />
            </SectionCard.Body>
          </SectionCard>
        </section>
      </div>
    </PageLayout>
  );
}
