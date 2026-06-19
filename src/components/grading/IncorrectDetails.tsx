"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { renderRichText } from "@/lib/rich-text";

interface ChevronIconProps {
  expanded: boolean;
}

function ChevronIcon({ expanded }: ChevronIconProps) {
  if (expanded) {
    return <ChevronUp size={14} />;
  }
  return <ChevronDown size={14} />;
}
import { WordDiff } from "@/components/lesson/WordDiff";

export interface IncorrectDetailsProps {
  feedbackDetails: {
    whatWasWrong?: string | null;
    whyItWasWrong?: string | null;
    correctUnderstanding?: string | null;
    nextPracticeItem?: string | null;
    detailedExplanation?: string | null;
  };
  isSubjectiveType?: boolean;
  naturalAnswer?: string | null;
  answer: string;
}

export function IncorrectDetails({
  feedbackDetails,
  isSubjectiveType,
  naturalAnswer,
  answer,
}: IncorrectDetailsProps) {
  const [showExplainMore, setShowExplainMore] = useState(false);

  return (
    <div className="grid gap-3 mt-3 text-left">
      {feedbackDetails.whatWasWrong ? (
        <div className="p-3 bg-danger-light border-l-4 border-danger rounded-r-lg text-sm text-text">
          <strong className="text-xs text-danger font-bold block mb-1">
            Lỗi sai phát hiện:
          </strong>
          {feedbackDetails.whatWasWrong}
        </div>
      ) : null}

      {feedbackDetails.whyItWasWrong ? (
        <div className="p-3 bg-warning-light border-l-4 border-warning rounded-r-lg text-sm text-text">
          <strong className="text-xs text-warning font-bold block mb-1">
            Lý do nhầm lẫn:
          </strong>
          {feedbackDetails.whyItWasWrong}
        </div>
      ) : null}

      {feedbackDetails.correctUnderstanding ? (
        <div className="p-3 bg-success-light border-l-4 border-success rounded-r-lg text-sm text-text">
          <strong className="text-xs text-success font-bold block mb-1 font-semibold">
            Hiểu đúng tự nhiên trong ngữ cảnh:
          </strong>
          {feedbackDetails.correctUnderstanding}
        </div>
      ) : null}

      {feedbackDetails.nextPracticeItem ? (
        <div className="p-3 bg-accent-light border-l-4 border-accent rounded-r-lg text-sm text-text">
          <strong className="text-xs text-accent font-bold block mb-1">
            Luyện tập nhanh:
          </strong>
          {feedbackDetails.nextPracticeItem}
        </div>
      ) : null}

      {isSubjectiveType && naturalAnswer ? (
        <div className="p-3 bg-surface border border-border rounded-lg text-sm text-text">
          <strong className="text-xs text-muted font-bold block mb-1">
            So sánh lỗi:
          </strong>
          <div className="mt-1 font-semibold">
            <WordDiff original={answer} corrected={naturalAnswer} />
          </div>
        </div>
      ) : null}

      {/* Explain More toggler */}
      {feedbackDetails.detailedExplanation ? (
        <div className="border border-border rounded-lg bg-surface/50 overflow-hidden transition-all duration-200 mt-1">
          <button
            type="button"
            onClick={() => setShowExplainMore(!showExplainMore)}
            className="w-full flex items-center justify-between p-3 px-4 text-xs font-bold text-muted hover:bg-surface-active cursor-pointer transition-all leading-none"
          >
            <span>Giải thích thêm (Explain more)</span>
            <ChevronIcon expanded={showExplainMore} />
          </button>
          <div
            data-state={showExplainMore ? "open" : "closed"}
            className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-300 ease-in-out data-[state=open]:grid-rows-[1fr] data-[state=open]:opacity-100"
          >
            <div className="overflow-hidden">
              <div className="p-4 pt-2 text-sm leading-relaxed text-text border-t border-border/30 bg-surface/30">
                {renderRichText(feedbackDetails.detailedExplanation)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
