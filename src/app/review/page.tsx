import { requireUser } from "@/lib/auth/guards";
import { ReviewSession } from "./session";
import { getMistakePatternRepository } from "@/domain/memory";
import { getMistakePatternLessonsMap } from "@/app/actions/review";
import { PageLayout } from "@/components/ui/page-layout";
import { PageHeader } from "@/components/ui/page-header";

interface PageProps {
  searchParams: Promise<{ patternId?: string }>;
}

export default async function ReviewPage({ searchParams }: PageProps) {
  const { patternId } = await searchParams;
  const user = await requireUser();
  const repo = getMistakePatternRepository();

  let rawPatterns;
  if (patternId) {
    const specificPattern = await repo.findMistakePattern(patternId, user.id);
    if (specificPattern && specificPattern.reviewPromptStatus === "succeeded") {
      rawPatterns = [specificPattern];
    } else {
      rawPatterns = await repo.findDueMistakePatterns(user.id, new Date(), 20);
    }
  } else {
    rawPatterns = await repo.findDueMistakePatterns(user.id, new Date(), 20);
  }

  const patterns = rawPatterns.map((p) => p.toPlainObject());
  const lessonsMap = await getMistakePatternLessonsMap(user.id);

  return (
    <PageLayout user={user}>
      <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
        <PageHeader
          title="Ôn tập mẫu lỗi (Spaced Repetition)"
          description="Ôn tập sử dụng ngữ cảnh khái quát hóa an toàn, không chứa thông tin cá nhân từ bài học gốc."
          className="text-center sm:text-left border-none pb-0 mb-0"
        />

        <div className="w-full">
          <ReviewSession patterns={patterns} lessonsMap={lessonsMap} />
        </div>
      </div>
    </PageLayout>
  );
}
