"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { renderRichText } from "@/lib/rich-text";
import confetti from "canvas-confetti";
import { FeedbackHeader } from "@/components/grading/FeedbackHeader";
import { IncorrectDetails } from "@/components/grading/IncorrectDetails";
import { AnswerSuggestions } from "@/components/grading/AnswerSuggestions";

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
  showSuggestion?: boolean;
  // Review specific
  nextReviewDate?: string | null;
  masteryState?: string | null;
  score?: number;
  shouldConfetti?: boolean;
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
  showSuggestion,
  nextReviewDate,
  masteryState,
  score,
  shouldConfetti = true,
}: GradingFeedbackProps) {
  const isReview = type === "review";

  useEffect(() => {
    let t1: NodeJS.Timeout | undefined;
    let t2: NodeJS.Timeout | undefined;

    if (shouldConfetti && isCorrect && score !== undefined && score >= 70) {
      let particleCount = 50;
      if (score >= 95) {
        particleCount = 130;
      } else if (score >= 85) {
        particleCount = 90;
      }

      // Left corner burst
      confetti({
        particleCount,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.85 },
      });

      // Right corner burst
      confetti({
        particleCount,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.85 },
      });

      // Extra bursts for high scores
      if (score >= 85) {
        t1 = setTimeout(() => {
          confetti({
            particleCount: Math.round(particleCount * 0.7),
            angle: 60,
            spread: 60,
            origin: { x: 0.05, y: 0.75 },
          });
          confetti({
            particleCount: Math.round(particleCount * 0.7),
            angle: 120,
            spread: 60,
            origin: { x: 0.95, y: 0.75 },
          });
        }, 200);
      }

      if (score >= 95) {
        t2 = setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 90,
            spread: 80,
            origin: { x: 0.5, y: 0.65 },
          });
        }, 400);
      }
    }

    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [isCorrect, score, shouldConfetti]);

  const outerClassName = isReview
    ? `animate-slide-in-up grid gap-2 border-t border-border pt-4 mt-2 rounded-xl p-5 border ${
        isCorrect
          ? "bg-success-light/45 border-success/20"
          : "bg-warning-light/45 border-warning/20"
      }`
    : "animate-slide-in-up grid gap-1.5 border-t border-border pt-4 mt-2";

  return (
    <div className={outerClassName}>
      <FeedbackHeader
        isReview={isReview}
        isCorrect={isCorrect}
        mistakeType={feedbackDetails?.mistakeType}
      />

      {/* High-level feedback summary */}
      <div className="text-sm leading-relaxed m-0 text-text font-medium text-left">
        {renderRichText(feedbackVi)}
      </div>

      {/* In-depth structured feedback when incorrect */}
      {!isCorrect && feedbackDetails ? (
        <IncorrectDetails
          feedbackDetails={feedbackDetails}
          answer={answer}
          naturalAnswer={naturalAnswer}
          isSubjectiveType={isSubjectiveType}
        />
      ) : (
        /* Suggestions/natural translation when correct */
        <AnswerSuggestions
          isReview={isReview}
          isCorrect={isCorrect}
          naturalAnswer={naturalAnswer}
          solved={solved}
          isSubjectiveType={isSubjectiveType}
          showSuggestion={showSuggestion}
          literalTranslationTrap={literalTranslationTrap}
          answer={answer}
        />
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
