import { requireUser } from "@/lib/auth/guards";
import { PhrasePracticeSession } from "./session";
import { getPhrasePracticeRepository, PhrasePractice } from "@/domain/memory";
import { PageLayout } from "@/components/ui/page-layout";
import { PageHeader } from "@/components/ui/page-header";

interface PageProps {
  searchParams: Promise<{ practiceId?: string }>;
}

export default async function PhrasePracticePage({ searchParams }: PageProps) {
  const [{ practiceId }, user] = await Promise.all([
    searchParams,
    requireUser(),
  ]);
  const repo = getPhrasePracticeRepository();

  let rawPractices: PhrasePractice[];
  if (practiceId) {
    const specificPractice = await repo.findPhrasePractice(practiceId, user.id);
    if (
      specificPractice &&
      specificPractice.reviewPromptStatus === "succeeded"
    ) {
      rawPractices = [specificPractice];
    } else {
      rawPractices = await repo.findDuePhrasePractices(user.id, new Date(), 20);
    }
  } else {
    rawPractices = await repo.findDuePhrasePractices(user.id, new Date(), 20);
  }

  const practices = rawPractices.map((p) => p.toPlainObject());

  return (
    <PageLayout user={user}>
      <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
        <PageHeader
          title="Luyện tập cụm từ chủ động (Spaced Repetition)"
          description="Ôn tập các từ khóa và cụm từ quan trọng được trích xuất từ bài học của bạn."
          className="text-center sm:text-left border-none pb-0 mb-0"
        />

        <div className="w-full">
          <PhrasePracticeSession practices={practices} />
        </div>
      </div>
    </PageLayout>
  );
}
