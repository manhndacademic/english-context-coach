import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { ReviewSession } from "./session";
import { getMistakePatternRepository } from "@/domain/memory";

export default async function ReviewPage() {
  const user = await requireUser();
  const repo = getMistakePatternRepository();
  const rawPatterns = await repo.findDueMistakePatterns(
    user.id,
    new Date(),
    20
  );
  const patterns = rawPatterns.map((p) => p.toPlainObject());

  return (
    <>
      <AppHeader email={user.email} isAdmin={user.role === "admin"} />
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-6 pb-10 flex flex-col gap-6">
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold font-serif mb-1 text-text m-0">
              Ôn tập mẫu lỗi (Spaced Repetition)
            </h1>
            <p className="text-muted text-sm leading-relaxed m-0 mt-1.5">
              Ôn tập sử dụng ngữ cảnh khái quát hóa an toàn, không chứa thông
              tin cá nhân từ bài học gốc.
            </p>
          </div>

          <div className="w-full">
            <ReviewSession patterns={patterns} />
          </div>
        </div>
      </main>
    </>
  );
}
