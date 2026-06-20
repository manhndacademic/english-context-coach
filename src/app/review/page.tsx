import { requireUser } from "@/lib/auth/guards";
import { ReviewSession } from "./session";
import {
  getMistakePatternRepository,
  getPhrasePracticeRepository,
} from "@/domain/memory";
import { PageLayout } from "@/components/ui/page-layout";
import { PageHeader } from "@/components/ui/page-header";

interface PageProps {
  searchParams: Promise<{ patternId?: string }>;
}

async function fetchUnifiedReviewItems(userId: string, patternId?: string) {
  const repo = getMistakePatternRepository();
  const phraseRepo = getPhrasePracticeRepository();

  let unifiedItems: any[] = [];
  let specificItem: any = null;

  const nowMs = Date.now();
  const checkIsRecent = (plain: any) => {
    if (!plain.draftPhrase) return false;
    const createdTime = new Date(plain.createdAt).getTime();
    return nowMs - createdTime <= 7 * 24 * 60 * 60 * 1000;
  };

  if (patternId) {
    const pattern = await repo.findMistakePattern(patternId, userId);
    if (pattern && pattern.reviewPromptStatus === "succeeded") {
      const plain = pattern.toPlainObject();
      specificItem = {
        ...plain,
        itemType: "pattern",
        isRecent: checkIsRecent(plain),
      };
    } else {
      const practice = await phraseRepo.findPhrasePractice(patternId, userId);
      if (practice) {
        const plain = practice.toPlainObject();
        specificItem = {
          ...plain,
          itemType: "practice",
          errorType: "phrase_misunderstanding",
          isRecent: checkIsRecent(plain),
        };
      }
    }
  }

  if (specificItem) {
    unifiedItems = [specificItem];
  } else {
    const [duePatterns, duePractices] = await Promise.all([
      repo.findDueMistakePatterns(userId, new Date(), 20),
      phraseRepo.findDuePhrasePractices(userId, new Date(), 20),
    ]);

    const mappedPatterns = duePatterns.map((p) => {
      const plain = p.toPlainObject();
      return {
        ...plain,
        itemType: "pattern" as const,
        isRecent: checkIsRecent(plain),
      };
    });
    const mappedPractices = duePractices.map((p) => {
      const plain = p.toPlainObject();
      return {
        ...plain,
        itemType: "practice" as const,
        errorType: "phrase_misunderstanding",
        isRecent: checkIsRecent(plain),
      };
    });

    unifiedItems = [...mappedPatterns, ...mappedPractices];
  }

  return unifiedItems;
}

export default async function ReviewPage({ searchParams }: PageProps) {
  const [{ patternId }, user] = await Promise.all([
    searchParams,
    requireUser(),
  ]);

  const repo = getMistakePatternRepository();
  const [unifiedItems, lessonsMap] = await Promise.all([
    fetchUnifiedReviewItems(user.id, patternId),
    repo.getLessonsForPatterns(user.id),
  ]);

  return (
    <PageLayout user={user}>
      <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
        <PageHeader
          title="Ôn tập tổng hợp"
          description="Ôn tập các mẫu lỗi và cụm từ ghi nhớ sử dụng Spaced Repetition (SRS)."
          className="text-center sm:text-left border-none pb-0 mb-0"
        />

        <div className="w-full">
          <ReviewSession patterns={unifiedItems} lessonsMap={lessonsMap} />
        </div>
      </div>
    </PageLayout>
  );
}
