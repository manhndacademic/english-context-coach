import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { SourceTextForm } from "@/components/source-text-form";
import { getLessonRepository } from "@/domain/lesson";
import { getLearnerMemoryRepository } from "@/domain/memory";
import { 
  FileText, 
  BrainCircuit, 
  Calendar, 
  Sparkles, 
  ArrowRight, 
  BookOpen, 
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Mail,
  Code,
  MessageSquare,
  FileCode2
} from "lucide-react";

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();

  const memoryRepo = getLearnerMemoryRepository();
  const lessonRepo = getLessonRepository();

  const [recentLessons, sourceCount, metrics] = await Promise.all([
    lessonRepo.getRecentLessons(user.id, 6),
    lessonRepo.getSourceTextsCount(user.id),
    memoryRepo.getDashboardMetrics(user.id, now),
  ]);

  const dueCount = metrics.dueCount;
  const patternCount = metrics.patternCount;
  const repeatedMistakes = metrics.repeatedMistakes;

  const translateStatus = (status: string) => {
    switch (status) {
      case "pending": return { label: "Đang chờ", icon: <Clock size={12} />, className: "status-pending" };
      case "running": return { label: "Đang phân tích", icon: <BrainCircuit size={12} className="animate-spin" />, className: "status-running" };
      case "succeeded": return { label: "Sẵn sàng", icon: <CheckCircle size={12} />, className: "status-succeeded" };
      case "failed": return { label: "Lỗi phân tích", icon: <XCircle size={12} />, className: "status-failed" };
      default: return { label: status, icon: null, className: "" };
    }
  };

  const getDocIcon = (type: string) => {
    switch (type) {
      case "work_message": return <MessageSquare size={16} className="text-muted" />;
      case "technical_doc": return <FileCode2 size={16} className="text-muted" />;
      case "email": return <Mail size={16} className="text-muted" />;
      case "academic": return <BookOpen size={16} className="text-muted" />;
      case "code": return <Code size={16} className="text-muted" />;
      default: return <FileText size={16} className="text-muted" />;
    }
  };

  return (
    <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
      <AppHeader email={user.email} />
      
      <div className="grid grid-cols-1 min-[860px]:grid-cols-[1.4fr_0.8fr] gap-7 items-start">
        <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
          <div className="flex items-start gap-4 flex-col sm:flex-row">
            <div className="bg-accent-light text-accent p-3 rounded-md shrink-0">
              <Sparkles size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-[28px] font-bold font-serif mb-1.5 text-text m-0">Hiểu tiếng Anh trong ngữ cảnh</h1>
              <p className="text-muted text-sm leading-relaxed m-0">
                Dán văn bản tiếng Anh từ công việc, học tập, tài liệu API, email hoặc tin nhắn Slack. Hệ thống sẽ phân tích bẫy dịch từng từ và tạo bài học tự động.
              </p>
            </div>
          </div>
          
          <div className="border-t border-border pt-5 mt-1">
            <SourceTextForm />
          </div>
        </section>

        <aside className="grid gap-6">
          {/* Spaced Repetition Summary Box */}
          <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-4">
            <h2 className="text-xl font-bold text-text flex items-center gap-2 m-0">
              <Calendar size={18} className="text-muted" /> Hôm nay của bạn
            </h2>
            <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-2.5">
              <div className="bg-surface-strong rounded-md p-3.5 grid gap-1">
                <span className="text-muted text-[11px] font-semibold uppercase tracking-wider leading-none">Cần ôn tập</span>
                <strong className={`text-2xl font-bold block leading-tight ${dueCount > 0 ? "text-warning" : "text-text"}`}>{dueCount}</strong>
              </div>
              <div className="bg-surface-strong rounded-md p-3.5 grid gap-1">
                <span className="text-muted text-[11px] font-semibold uppercase tracking-wider leading-none">Mẫu lỗi lưu</span>
                <strong className="text-2xl font-bold block leading-tight">{patternCount}</strong>
              </div>
              <div className="bg-surface-strong rounded-md p-3.5 grid gap-1">
                <span className="text-muted text-[11px] font-semibold uppercase tracking-wider leading-none">Nguồn dán</span>
                <strong className="text-2xl font-bold block leading-tight">{sourceCount}</strong>
              </div>
            </div>
            <Link 
              className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-transparent px-5 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)] w-full" 
              href="/review"
            >
              Bắt đầu ôn tập lỗi <ArrowRight size={14} />
            </Link>
          </section>

          {/* Repeated Mistakes Card */}
          <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-3.5">
            <h2 className="text-xl font-bold text-text flex items-center gap-2 m-0">
              <AlertCircle size={18} className="text-muted" /> Mẫu lỗi lặp lại nổi bật
            </h2>
            <div className="grid divide-y divide-border">
              {repeatedMistakes.length ? (
                repeatedMistakes.map((pattern) => (
                  <div className="py-3 flex flex-col gap-1 first:pt-0 last:pb-0" key={pattern.id}>
                    <div className="flex justify-between items-center gap-2">
                      <strong className="text-accent-strong text-[15px] font-bold">{pattern.normalizedPhrase}</strong>
                      <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2 py-0.5 text-muted text-[10px] font-extrabold leading-none">
                        Gặp {pattern.occurrenceCount} lần
                      </span>
                    </div>
                    <span className="text-muted text-sm leading-relaxed">Nghĩa đúng: {pattern.meaningVi}</span>
                    <span className="inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-extrabold bg-danger-light border border-danger text-danger uppercase tracking-wider mt-1 leading-none">
                      {pattern.errorType.replaceAll("_", " ")}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-muted text-sm leading-relaxed m-0 pt-2">
                  Các mẫu lỗi sai lặp lại sẽ xuất hiện ở đây sau khi bạn làm bài tập và tích lũy bộ nhớ lỗi.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* Recent Lessons Section */}
      <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-[18px] mt-6">
        <h2 className="text-2xl font-bold text-text flex items-center gap-2.5 m-0">
          <BookOpen size={20} className="text-muted" /> Các bài học gần đây
        </h2>
        <div className="grid gap-4">
          {recentLessons.length ? (
            recentLessons.map((lesson) => {
              const analysis = translateStatus(lesson.analysisStatus);
              const exercise = translateStatus(lesson.exerciseStatus);
              return (
                <Link 
                  className="flex flex-col min-[600px]:flex-row items-stretch min-[600px]:items-center justify-between gap-3 min-[600px]:gap-4 p-4 border border-border rounded-md bg-surface text-text no-underline transition-all duration-150 hover:-translate-y-px hover:border-accent hover:shadow-sm" 
                  href={`/lessons/${lesson.id}`} 
                  key={lesson.id}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="bg-surface-strong p-2.5 rounded-md flex items-center justify-center shrink-0">
                      {getDocIcon(lesson.textType)}
                    </div>
                    <div className="min-w-0 grid gap-1">
                      <strong className="text-base font-bold text-text truncate block">
                        {lesson.title || "Bài học không tên"}
                      </strong>
                      <span className="text-muted text-xs leading-none truncate block">
                        Thể loại: {lesson.textType?.replaceAll("_", " ") ?? "general"} · Trình độ: {lesson.detectedLevel ?? "Đang xác định"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-start min-[600px]:justify-end gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold border leading-none ${analysis.className}`}>
                      {analysis.icon}
                      <span>Phân tích: {analysis.label}</span>
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold border leading-none ${exercise.className}`}>
                      {exercise.icon}
                      <span>Bài tập: {exercise.label}</span>
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold border border-border bg-surface-strong text-muted leading-none">
                      v{lesson.version}
                    </span>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="text-muted text-sm leading-relaxed m-0">
              Chưa có bài học nào. Hãy dán một đoạn văn bản tiếng Anh ở trên để bắt đầu bài học đầu tiên.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
