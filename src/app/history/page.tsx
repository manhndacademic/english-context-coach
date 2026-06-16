import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { getLessonRepository } from "@/domain/lesson";
import {
  getLearnerMemoryEngine,
  getMistakePatternRepository,
} from "@/domain/memory";
import { getMistakePatternLessonsMap } from "@/app/actions/review";
import Link from "next/link";
import {
  ArrowLeft,
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
    <>
      <AppHeader
        email={user.email}
        isAdmin={user.role === "admin"}
        image={user.image}
      />
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-6 pb-10 flex flex-col gap-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-bold text-accent no-underline hover:underline mb-2"
            >
              <ArrowLeft size={12} /> Quay về Trang chủ
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif mb-1 text-text m-0 flex items-center gap-2">
              <History size={26} className="text-accent" /> Lịch sử học tập
            </h1>
            <p className="text-muted text-sm leading-relaxed m-0 mt-1">
              Xem lại tiến trình hoàn thành bài học, các câu đã thực hành và tần
              suất ôn tập mẫu lỗi.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 min-[960px]:grid-cols-6 gap-4">
          <div className="hover-lift bg-surface border border-border rounded-lg p-4 shadow-sm grid gap-1">
            <span className="text-muted text-[10px] font-bold uppercase tracking-wider">
              Bài học đã học
            </span>
            <strong className="text-2xl font-bold text-text leading-tight">
              {lessonsCompleted}
            </strong>
          </div>
          <div className="hover-lift bg-surface border border-border rounded-lg p-4 shadow-sm grid gap-1">
            <span className="text-muted text-[10px] font-bold uppercase tracking-wider">
              Luyện tập đúng
            </span>
            <strong className="text-2xl font-bold text-accent leading-tight">
              {exercisesCompleted}
            </strong>
          </div>
          <div className="hover-lift bg-surface border border-border rounded-lg p-4 shadow-sm grid gap-1">
            <span className="text-muted text-[10px] font-bold uppercase tracking-wider">
              Mẫu lỗi lưu
            </span>
            <strong className="text-2xl font-bold text-text leading-tight">
              {patternCount}
            </strong>
          </div>
          <div className="hover-lift bg-surface border border-border rounded-lg p-4 shadow-sm grid gap-1">
            <span className="text-muted text-[10px] font-bold uppercase tracking-wider">
              Cần ôn tập
            </span>
            <strong
              className={`text-2xl font-bold leading-tight ${dueCount > 0 ? "text-warning" : "text-text"}`}
            >
              {dueCount}
            </strong>
          </div>
          <div className="hover-lift bg-surface border border-border rounded-lg p-4 shadow-sm grid gap-1">
            <span className="text-muted text-[10px] font-bold uppercase tracking-wider">
              Đã thành thạo
            </span>
            <strong className="text-2xl font-bold text-success leading-tight">
              {masteredCount}
            </strong>
          </div>
          <div className="hover-lift bg-surface border border-border rounded-lg p-4 shadow-sm grid gap-1">
            <span className="text-muted text-[10px] font-bold uppercase tracking-wider">
              Lặp lại TB
            </span>
            <strong className="text-2xl font-bold text-text leading-tight">
              {avgRepetitions} lần
            </strong>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 min-[960px]:grid-cols-[1fr_1.5fr] gap-6 items-start">
          {/* Recent Lessons Panel */}
          <section className="bg-surface border border-border rounded-lg p-5 shadow-md flex flex-col gap-4">
            <h2 className="text-lg font-bold text-text flex items-center gap-2 m-0 border-b border-border pb-3">
              <BookOpen size={18} className="text-accent" /> Bài học đã làm (
              {recentLessons.length})
            </h2>

            {recentLessons.length === 0 ? (
              <p className="text-muted text-sm m-0 py-4 text-center">
                Bạn chưa hoàn thành bài học nào. Hãy dán văn bản mới ở trang chủ
                để bắt đầu!
              </p>
            ) : (
              <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
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
                      <span className="shrink-0 text-[10px] font-extrabold uppercase bg-accent-light text-accent border border-accent/15 px-1.5 py-0.5 rounded leading-none">
                        {lesson.detectedLevel || "B1"}
                      </span>
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
          </section>

          {/* Learned Mistakes Panel */}
          <section className="bg-surface border border-border rounded-lg p-5 shadow-md flex flex-col gap-4">
            <h2 className="text-lg font-bold text-text flex items-center gap-2 m-0 border-b border-border pb-3">
              <TrendingUp size={18} className="text-accent" /> Cụm từ & Mẫu lỗi
              đã lưu ({patterns.length})
            </h2>

            {patterns.length === 0 ? (
              <p className="text-muted text-sm m-0 py-8 text-center">
                Chưa có mẫu lỗi nào được ghi nhận. Hãy trả lời câu hỏi bài học
                để hệ thống lưu lại các lỗi cần ôn tập.
              </p>
            ) : (
              <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-1">
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
                            <span className="inline-flex items-center gap-1 rounded-full bg-success-light border border-success text-success px-2 py-0.5 text-[9px] font-extrabold leading-none uppercase">
                              Thành thạo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning-light border border-warning text-warning px-2 py-0.5 text-[9px] font-extrabold leading-none uppercase">
                              Đang học
                            </span>
                          )}
                          <span className="text-muted text-[10px] font-bold border border-border px-1.5 py-0.5 rounded bg-surface leading-none">
                            Lặp {p.repetitions} lần
                          </span>
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
                        <span className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-extrabold bg-danger-light border border-danger text-danger uppercase tracking-wider leading-none whitespace-nowrap">
                          {p.errorType.replaceAll("_", " ")}
                        </span>

                        {p.reviewPromptStatus === "succeeded" ? (
                          <Link
                            href={`/review?patternId=${p.id}`}
                            className="inline-flex items-center gap-1 text-[10px] font-extrabold text-accent no-underline hover:underline bg-accent-light px-2 py-1 rounded"
                          >
                            Luyện ôn tập <ArrowRight size={10} />
                          </Link>
                        ) : p.reviewPromptStatus === "failed" ? (
                          <span className="text-danger text-[9px] font-bold leading-none bg-danger-light border border-danger/10 px-2 py-1 rounded">
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
          </section>
        </div>
      </main>
    </>
  );
}
