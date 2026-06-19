export interface FeedbackHeaderProps {
  isReview: boolean;
  isCorrect: boolean;
  mistakeType?: string | null;
}

export function FeedbackHeader({
  isReview,
  isCorrect,
  mistakeType,
}: FeedbackHeaderProps) {
  if (isReview) {
    return (
      <div className="flex items-center flex-wrap gap-2 text-left">
        <span
          className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
            isCorrect
              ? "bg-success/10 text-success"
              : "bg-warning/10 text-warning"
          }`}
        >
          {isCorrect ? "Đạt yêu cầu" : "Cần cải thiện"}
        </span>
        <strong
          className={`text-sm ${isCorrect ? "text-success" : "text-warning"}`}
        >
          {isCorrect ? "Hoàn thành xuất sắc" : "Gợi ý cải thiện"}
        </strong>
        {!isCorrect && mistakeType ? (
          <span className="inline-flex items-center bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/30">
            {mistakeType}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center flex-wrap gap-2 text-left">
      <strong className="text-sm font-bold">
        {isCorrect ? "Chính xác" : "Gợi ý cải thiện"}
      </strong>
      {!isCorrect && mistakeType ? (
        <span className="inline-flex items-center bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/30">
          {mistakeType}
        </span>
      ) : null}
    </div>
  );
}
