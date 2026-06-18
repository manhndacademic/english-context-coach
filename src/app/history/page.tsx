import { requireUser } from "@/lib/auth/guards";
import { getLessonRepository } from "@/domain/lesson";
import {
  getLearnerMemoryEngine,
  getMistakePatternRepository,
} from "@/domain/memory";
import { getMistakePatternLessonsMap } from "@/app/actions/review";
import Link from "next/link";
import { PageLayout } from "@/components/ui/page-layout";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/ui/section-card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Calendar,
  History,
  TrendingUp,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

export default async function HistoryPage() {
  const user = await requireUser();
  const now = new Date();

  const lessonRepo = getLessonRepository();
  const memoryRepo = getMistakePatternRepository();
  const memoryEngine = getLearnerMemoryEngine();

  const [patterns, recentLessons, dashboardMetrics, lessonsMap] =
    await Promise.all([
      memoryRepo.findAllMistakePatterns(user.id),
      lessonRepo.getRecentLessons(user.id, 100),
      memoryEngine.getDashboardMetrics(user.id, now),
      getMistakePatternLessonsMap(user.id),
    ]);

  const {
    dueCount,
    patternCount,
    masteredCount,
    exercisesCompleted,
    lessonsCompleted,
  } = dashboardMetrics;

  // Compute average repetitions for active or mastered patterns
  const avgRepetitions =
    patterns.length > 0
      ? (
          patterns.reduce((sum, p) => sum + p.repetitions, 0) / patterns.length
        ).toFixed(1)
      : "0";

  return (
    <PageLayout user={user}>
      {/* Navigation & Header */}
      <PageHeader
        title="Lịch sử học tập"
        description="Xem lại tiến trình hoàn thành bài học, các câu đã thực hành và tần suất ôn tập mẫu lỗi."
        icon={<History size={26} />}
        backHref="/dashboard"
        backLabel="Quay về Trang chủ"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 min-[960px]:grid-cols-6 gap-4">
        <StatCard label="Bài học đã học" value={lessonsCompleted} />
        <StatCard
          label="Luyện tập đúng"
          value={exercisesCompleted}
          valueVariant="accent"
        />
        <StatCard label="Mẫu lỗi lưu" value={patternCount} />
        <StatCard
          label="Cần ôn tập"
          value={dueCount}
          valueVariant={dueCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Đã thành thạo"
          value={masteredCount}
          valueVariant="success"
        />
        <StatCard label="Lặp lại TB" value={`${avgRepetitions} lần`} />
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 min-[960px]:grid-cols-[1fr_1.5fr] gap-6 items-start">
        {/* Recent Lessons Panel */}
        <SectionCard className="p-5 sm:p-5">
          <SectionCard.Header
            title={`Bài học đã làm (${recentLessons.length})`}
            icon={<BookOpen size={18} className="text-accent" />}
          />

          <SectionCard.Body className="gap-3">
            {recentLessons.length === 0 ? (
              <p className="text-muted text-sm m-0 py-4 text-center">
                Bạn chưa hoàn thành bài học nào. Hãy dán văn bản mới ở trang chủ
                để bắt đầu!
              </p>
            ) : (
              <div className="flex flex-col gap-3 max-h-150 overflow-y-auto pr-1">
                {recentLessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="group bg-surface-strong border border-border rounded-md p-3.5 hover:border-accent/30 transition-all flex flex-col gap-2 relative"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <Link
                        href={`/lessons/${lesson.id}`}
                        className="text-text text-sm font-bold no-underline hover:text-accent group-hover:underline leading-snug"
                      >
                        {lesson.title || "Bài học không tên"}
                      </Link>
                      <Badge
                        variant="accent"
                        size="sm"
                        className="shrink-0 leading-none rounded uppercase text-[10px] px-1.5 py-0.5"
                      >
                        {lesson.detectedLevel || "B1"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-muted text-xs">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(lesson.createdAt).toLocaleDateString(
                          "vi-VN",
                          {
                            month: "numeric",
                            day: "numeric",
                          }
                        )}
                      </span>
                      <span>•</span>
                      <span className="capitalize">
                        {lesson.textType.replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard.Body>
        </SectionCard>

        {/* Learned Mistakes Panel */}
        <SectionCard className="p-5 sm:p-5">
          <SectionCard.Header
            title={`Cụm từ & Mẫu lỗi đã lưu (${patterns.length})`}
            icon={<TrendingUp size={18} className="text-accent" />}
          />

          <SectionCard.Body className="gap-4">
            {patterns.length === 0 ? (
              <p className="text-muted text-sm m-0 py-8 text-center">
                Chưa có mẫu lỗi nào được ghi nhận. Hãy trả lời câu hỏi bài học
                để hệ thống lưu lại các lỗi cần ôn tập.
              </p>
            ) : (
              <div className="flex flex-col gap-4 max-h-150 overflow-y-auto pr-1">
                {patterns.map((p) => {
                  const lessonsList =
                    lessonsMap[`${p.conceptKey}_${p.errorType}`] || [];
                  return (
                    <div
                      key={p.id}
                      className="bg-surface-strong border border-border rounded-md p-4 flex flex-col gap-2.5 transition-all hover:border-accent/20"
                    >
                      <div className="flex justify-between items-start gap-2 flex-wrap sm:flex-nowrap">
                        <div>
                          <strong className="text-accent-strong text-[15px] font-bold block">
                            {p.normalizedPhrase}
                          </strong>
                          <span className="text-muted text-xs leading-relaxed mt-0.5 block">
                            Nghĩa đúng: {p.meaningVi}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {p.masteryState === "mastered" ? (
                            <Badge
                              variant="success"
                              size="sm"
                              className="text-[9px] uppercase px-2 py-0.5 leading-none"
                            >
                              Thành thạo
                            </Badge>
                          ) : (
                            <Badge
                              variant="warning"
                              size="sm"
                              className="text-[9px] uppercase px-2 py-0.5 leading-none"
                            >
                              Đang học
                            </Badge>
                          )}
                          <Badge
                            variant="default"
                            size="sm"
                            className="bg-surface border-border leading-none text-muted rounded text-[10px] px-1.5 py-0.5"
                          >
                            Lặp {p.repetitions} lần
                          </Badge>
                        </div>
                      </div>

                      {/* Related lessons backlinks */}
                      {lessonsList.length > 0 && (
                        <div className="flex flex-col gap-1 bg-surface/40 p-2 rounded border border-border/40">
                          <span className="text-[10px] text-muted font-bold block">
                            GẶP LỖI TRONG CÁC BÀI HỌC:
                          </span>
                          <div className="flex flex-wrap gap-x-2 gap-y-1.5 mt-0.5">
                            {lessonsList.map((l) => (
                              <Link
                                key={l.id}
                                href={`/lessons/${l.id}`}
                                className="inline-flex items-center gap-0.5 text-[10px] text-accent hover:underline font-semibold"
                              >
                                <ExternalLink size={8} />{" "}
                                {l.title || "Bài học gốc"}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-0.5 pt-2 border-t border-border/50">
                        <Badge
                          variant="danger"
                          size="sm"
                          className="text-[9px] uppercase tracking-wider px-2 py-0.5 leading-none whitespace-nowrap"
                        >
                          {p.errorType.replaceAll("_", " ")}
                        </Badge>

                        {p.reviewPromptStatus === "succeeded" ? (
                          <Link
                            href={`/review?patternId=${p.id}`}
                            className="inline-flex items-center gap-1 text-[10px] font-extrabold text-accent-strong no-underline hover:underline bg-accent-light px-2 py-1 rounded"
                          >
                            Luyện ôn tập <ArrowRight size={10} />
                          </Link>
                        ) : p.reviewPromptStatus === "failed" ? (
                          <span className="text-danger-strong text-[9px] font-bold leading-none bg-danger-light border border-danger/10 px-2 py-1 rounded">
                            Lỗi tạo câu hỏi
                          </span>
                        ) : (
                          <span className="text-muted text-[9px] font-bold leading-none bg-surface border border-border px-2 py-1 rounded">
                            Đang chuẩn bị câu hỏi...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard.Body>
        </SectionCard>
      </div>
    </PageLayout>
  );
}
