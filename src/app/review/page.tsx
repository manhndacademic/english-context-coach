import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { ReviewSession } from "./session";
import { getLearnerMemoryRepository } from "@/domain/memory";

export default async function ReviewPage() {
  const user = await requireUser();
  const repo = getLearnerMemoryRepository();
  const patterns = await repo.findDueMistakePatterns(user.id, new Date(), 20);

  return (
    <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
      <AppHeader email={user.email} />
      <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-serif mb-1 text-text m-0">
            Ôn tập mẫu lỗi (Spaced Repetition)
          </h1>
          <p className="text-muted text-sm leading-relaxed m-0 mt-1">
            Ôn tập sử dụng ngữ cảnh khái quát hóa an toàn, không chứa thông tin cá nhân từ bài học gốc.
          </p>
        </div>
        <div className="min-[860px]:max-w-[70%]">
          <ReviewSession patterns={patterns} />
        </div>
      </section>
    </main>
  );
}
