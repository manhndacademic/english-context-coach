"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, AlertCircle } from "lucide-react";
import { renderRichText } from "@/lib/rich-text";

interface GradingFeedbackProps {
  type: "exercise" | "review";
  isCorrect: boolean;
  feedbackVi: string;
  answer: string;
  feedbackDetails?: {
    whatWasWrong?: string | null;
    whyItWasWrong?: string | null;
    correctUnderstanding?: string | null;
    nextPracticeItem?: string | null;
    detailedExplanation?: string | null;
    mistakeType?: string | null;
  } | null;
  naturalAnswer?: string | null;
  literalTranslationTrap?: string | null;
  // Exercise specific
  solved?: boolean;
  isSubjectiveType?: boolean;
  isRepeated?: boolean;
  // Review specific
  nextReviewDate?: string | null;
  masteryState?: string | null;
}

export function GradingFeedback({
  type,
  isCorrect,
  feedbackVi,
  answer,
  feedbackDetails,
  naturalAnswer,
  literalTranslationTrap,
  solved,
  isSubjectiveType,
  isRepeated,
  nextReviewDate,
  masteryState,
}: GradingFeedbackProps) {
  const [showExplainMore, setShowExplainMore] = useState(false);
  const isReview = type === "review";

  const outerClassName = isReview
    ? `grid gap-2 border-t border-border pt-4 mt-2 animate-in fade-in slide-in-from-top-3 duration-200 rounded-xl p-5 border ${
        isCorrect
          ? "bg-success-light/45 border-success/20"
          : "bg-warning-light/45 border-warning/20"
      }`
    : "grid gap-1.5 border-t border-border pt-4 mt-2";

  return (
    <div className={outerClassName}>
      {/* Header section */}
      {isReview ? (
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
          {!isCorrect && feedbackDetails?.mistakeType ? (
            <span className="inline-flex items-center bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/30">
              {feedbackDetails.mistakeType}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center flex-wrap gap-2 text-left">
          <strong className="text-sm font-bold">
            {isCorrect ? "Chính xác" : "Gợi ý cải thiện"}
          </strong>
          {!isCorrect && feedbackDetails?.mistakeType ? (
            <span className="inline-flex items-center bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/30">
              {feedbackDetails.mistakeType}
            </span>
          ) : null}
        </div>
      )}

      {/* High-level feedback summary */}
      <div className="text-sm leading-relaxed m-0 text-text font-medium text-left">
        {renderRichText(feedbackVi)}
      </div>

      {/* In-depth structured feedback when incorrect */}
      {!isCorrect && feedbackDetails ? (
        <div className="grid gap-3 mt-3 text-left">
          <div className="p-3 bg-danger-light border-l-4 border-danger rounded-r-lg text-sm text-text">
            <strong className="text-xs text-danger font-bold block mb-1">
              Lỗi sai phát hiện:
            </strong>
            {feedbackDetails.whatWasWrong}
          </div>

          <div className="p-3 bg-warning-light border-l-4 border-warning rounded-r-lg text-sm text-text">
            <strong className="text-xs text-warning font-bold block mb-1">
              Lý do nhầm lẫn:
            </strong>
            {feedbackDetails.whyItWasWrong}
          </div>

          <div className="p-3 bg-success-light border-l-4 border-success rounded-r-lg text-sm text-text">
            <strong className="text-xs text-success font-bold block mb-1 font-semibold">
              Hiểu đúng tự nhiên trong ngữ cảnh:
            </strong>
            {feedbackDetails.correctUnderstanding}
          </div>

          {feedbackDetails.nextPracticeItem ? (
            <div className="p-3 bg-accent-light border-l-4 border-accent rounded-r-lg text-sm text-text">
              <strong className="text-xs text-accent font-bold block mb-1">
                Luyện tập nhanh:
              </strong>
              {feedbackDetails.nextPracticeItem}
            </div>
          ) : null}

          {/* Explain More toggler */}
          <div className="border border-border rounded-lg bg-surface/50 overflow-hidden transition-all duration-200 mt-1">
            <button
              type="button"
              onClick={() => setShowExplainMore(!showExplainMore)}
              className="w-full flex items-center justify-between p-3 px-4 text-xs font-bold text-muted hover:bg-surface-active cursor-pointer transition-all leading-none"
            >
              <span>Giải thích thêm (Explain more)</span>
              {showExplainMore ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
            <div
              data-state={showExplainMore ? "open" : "closed"}
              className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-300 ease-in-out data-[state=open]:grid-rows-[1fr] data-[state=open]:opacity-100"
            >
              <div className="overflow-hidden">
                <div className="p-4 pt-2 text-sm leading-relaxed text-text border-t border-border/30 bg-surface/30">
                  {renderRichText(feedbackDetails.detailedExplanation || "")}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Suggestions/natural translation when correct */
        <>
          {isReview ? (
            <div className="grid gap-1.5 bg-surface border border-border rounded-lg p-3 mt-1 text-left">
              <strong className="text-xs font-bold uppercase tracking-wider text-muted">
                Đáp án tự nhiên
              </strong>
              <div className="text-sm leading-relaxed m-0 text-text font-semibold">
                {renderRichText(naturalAnswer || "")}
              </div>
            </div>
          ) : (
            <>
              {naturalAnswer && solved && isSubjectiveType ? (
                <div className="mt-3 p-3 px-4 rounded-md bg-success-light border-l-4 border-success text-left">
                  <strong className="text-xs font-bold text-success block">
                    Gợi ý
                  </strong>
                  <p className="m-0 mt-1 text-sm md:text-base leading-relaxed font-semibold">
                    {naturalAnswer}
                  </p>
                </div>
              ) : null}
            </>
          )}

          {!isCorrect && literalTranslationTrap ? (
            <div className="mt-3 p-3 px-4 rounded-md bg-danger-light border-l-4 border-danger text-left">
              <strong className="text-xs font-bold text-danger block">
                Bẫy dịch từng từ (Literal Trap)
              </strong>
              <p className="m-0 mt-1 text-sm md:text-base leading-relaxed">
                Tránh dịch:{" "}
                <span className="line-through opacity-80">
                  &quot;{literalTranslationTrap}&quot;
                </span>
              </p>
            </div>
          ) : null}
        </>
      )}

      {/* Review-specific metadata */}
      {isReview && nextReviewDate ? (
        <p className="text-xs text-muted m-0 text-left mt-2">
          {masteryState === "mastered"
            ? "Mẫu lỗi này đã được đánh dấu thành thạo."
            : `Lần ôn tiếp theo: ${nextReviewDate}.`}
        </p>
      ) : null}

      {/* Submited answer recap (if incorrect) */}
      {!isCorrect ? (
        <p className="text-xs text-muted mt-1.5 text-left">
          {isReview ? (
            <span className="border-t border-border/20 pt-2 mt-1 italic block">
              Bản dịch vừa thử: &quot;{answer}&quot;
            </span>
          ) : (
            `Câu trả lời vừa gửi: ${answer}`
          )}
        </p>
      ) : null}

      {/* Repeated mistake warning */}
      {!isReview && isRepeated ? (
        <div className="flex items-center gap-2 bg-[#fff5f4] border border-[#f2b8b5] text-danger p-2 px-3 rounded-md text-xs sm:text-sm mt-3 text-left">
          <AlertCircle size={14} aria-hidden="true" />
          <span>Bạn đã từng gặp lỗi này trước đây.</span>
        </div>
      ) : null}
    </div>
  );
}
