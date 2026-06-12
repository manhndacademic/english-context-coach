import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { ReviewSession } from "./session";
import { getLearnerMemoryRepository } from "@/domain/memory";

export default async function ReviewPage() {
  const user = await requireUser();
  const repo = getLearnerMemoryRepository();
  const patterns = await repo.findDueMistakePatterns(user.id, new Date(), 20);

  return (
    <main className="app-shell">
      <AppHeader email={user.email} />
      <section className="panel stack">
        <div>
          <h1>Ôn tập mẫu lỗi (Spaced Repetition)</h1>
          <p className="muted">Ôn tập sử dụng ngữ cảnh khái quát hóa an toàn, không chứa thông tin cá nhân từ bài học gốc.</p>
        </div>
        <div className="review-workspace">
          <ReviewSession patterns={patterns} />
        </div>
      </section>
    </main>
  );
}
