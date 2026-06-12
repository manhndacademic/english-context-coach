import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { SourceTextForm } from "@/components/source-text-form";
import { getLessonRepository } from "@/domain/lesson";
import { getLearnerMemoryRepository } from "@/domain/memory";

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
      case "pending": return "Đang chờ";
      case "running": return "Đang xử lý";
      case "succeeded": return "Hoàn thành";
      case "failed": return "Lỗi";
      default: return status;
    }
  };

  return (
    <main className="app-shell">
      <AppHeader email={user.email} />
      <div className="page-grid">
        <section className="panel stack">
          <div>
            <h1 style={{ marginBottom: "8px" }}>Hiểu Tiếng Anh Trong Ngữ Cảnh</h1>
            <p className="muted" style={{ fontSize: "15px", lineHeight: "1.5" }}>
              Dán văn bản tiếng Anh thực tế từ công việc, học tập, tài liệu, email hoặc tin nhắn. Bài học sẽ được phân tích và tạo tự động trong nền.
            </p>
          </div>
          <SourceTextForm />
        </section>

        <aside className="stack">
          <section className="panel stack">
            <h2>Hôm nay</h2>
            <div className="metric-grid">
              <div className="metric">
                <strong>{dueCount}</strong>
                <span className="muted">lượt ôn tập</span>
              </div>
              <div className="metric">
                <strong>{patternCount}</strong>
                <span className="muted">mẫu lỗi</span>
              </div>
              <div className="metric">
                <strong>{sourceCount}</strong>
                <span className="muted">nguồn đã dán</span>
              </div>
            </div>
            <Link className="primary-button" href="/review" style={{ marginTop: "8px" }}>
              Bắt đầu ôn tập
            </Link>
          </section>

          <section className="panel stack">
            <h2>Mẫu lỗi lặp lại nổi bật</h2>
            <div className="list">
              {repeatedMistakes.length ? (
                repeatedMistakes.map((pattern) => (
                  <div className="list-row" key={pattern.id}>
                    <strong>{pattern.normalizedPhrase}</strong>
                    <span className="muted" style={{ fontSize: "14px" }}>{pattern.meaningVi}</span>
                    <span className="pill">{pattern.errorType.replaceAll("_", " ")}</span>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ fontSize: "14px" }}>Các mẫu lỗi sẽ xuất hiện ở đây sau khi bạn tích lũy bộ nhớ lỗi từ các bài tập.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="panel stack" style={{ marginTop: 22 }}>
        <h2>Bài học gần đây</h2>
        <div className="list">
          {recentLessons.length ? (
            recentLessons.map((lesson) => (
              <Link className="list-row" href={`/lessons/${lesson.id}`} key={lesson.id}>
                <strong>
                  {lesson.title || "Bài học không tên"} <span className="muted" style={{ fontSize: "13px", fontWeight: "normal" }}>v{lesson.version}</span>
                </strong>
                <span className="muted" style={{ fontSize: "13px" }}>
                  Phân tích: {translateStatus(lesson.analysisStatus)} · Bài tập: {translateStatus(lesson.exerciseStatus)}
                </span>
              </Link>
            ))
          ) : (
            <p className="muted" style={{ fontSize: "14px" }}>Chưa có bài học nào. Hãy dán một đoạn văn bản tiếng Anh ở trên để bắt đầu.</p>
          )}
        </div>
      </section>
    </main>
  );
}
