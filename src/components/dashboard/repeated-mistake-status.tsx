import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface RepeatedMistakeStatusProps {
  patternId: string;
  reviewPromptStatus: string;
  dueAt?: string | Date | null;
  now?: number;
  retryAction?: any;
}

export function RepeatedMistakeStatus({
  patternId,
  reviewPromptStatus,
  dueAt,
  now,
  retryAction,
}: RepeatedMistakeStatusProps) {
  if (reviewPromptStatus === "succeeded") {
    let nextReviewText = "";
    if (dueAt) {
      const dueTime = new Date(dueAt).getTime();
      // eslint-disable-next-line react-hooks/purity
      const current = now ?? Date.now();
      if (dueTime > current) {
        const diffMs = dueTime - current;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) {
          nextReviewText = "Hẹn ôn tập: Ngày mai";
        } else {
          nextReviewText = `Chờ ôn tập: ${diffDays} ngày nữa`;
        }
      }
    }

    if (nextReviewText) {
      return (
        <span className="inline-flex items-center text-[10px] font-bold text-muted bg-surface-strong px-2 py-0.5 rounded leading-none shrink-0 border border-border">
          {nextReviewText}
        </span>
      );
    }

    return (
      <Link
        href={`/review?patternId=${patternId}`}
        className="inline-flex items-center gap-1 text-[10px] font-bold text-accent no-underline hover:underline"
      >
        Ôn tập <ArrowRight size={10} />
      </Link>
    );
  }

  if (reviewPromptStatus === "failed") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-danger text-[10px] font-bold bg-danger-light border border-danger/10 px-2 py-0.5 rounded leading-none shrink-0">
          Lỗi tạo câu hỏi
        </span>
        <form action={retryAction} className="inline-flex items-center">
          <input type="hidden" name="patternId" value={patternId} />
          <button
            type="submit"
            className="text-[10px] font-extrabold text-accent bg-transparent border-none p-0 cursor-pointer hover:underline leading-none"
          >
            Tạo lại
          </button>
        </form>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted bg-surface-strong border border-border px-2 py-0.5 rounded leading-none shrink-0">
      <span className="w-1.5 h-1.5 bg-warning rounded-full animate-pulse shrink-0" />
      Đang chuẩn bị...
    </span>
  );
}
