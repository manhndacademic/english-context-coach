"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  SendHorizontal,
  HelpCircle,
  History,
} from "lucide-react";
import {
  submitReviewAttemptAction,
  type ReviewResultState,
} from "@/app/actions/review";
import type { MistakePatternPlain } from "@/domain/memory";
import { renderRichText } from "@/lib/rich-text";
import { Button } from "@/components/ui/button";
import { getReviewDisclosureState } from "@/components/review-disclosure";

function formatReviewDate(value?: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function ReviewCard({
  pattern,
  onComplete,
}: {
  pattern: MistakePatternPlain;
  onComplete: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [showExplainMore, setShowExplainMore] = useState(false);

  const [state, formAction, isPending] = useActionState<
    ReviewResultState,
    FormData
  >(submitReviewAttemptAction, {});

  const promptEn = pattern.reviewPromptEn ?? pattern.normalizedPhrase;
  const promptVi =
    pattern.reviewPromptVi ??
    `Dịch cụm từ hoặc câu sau sang nghĩa tự nhiên: "${pattern.normalizedPhrase}"`;
  const canSubmit = answer.trim().length > 0;
  const hasSubmitted = Boolean(state.success);
  const disclosure = getReviewDisclosureState(hasSubmitted);
  const nextReviewDate = formatReviewDate(state.nextReviewAt);
  const naturalAnswer =
    state.naturalAnswer ?? pattern.reviewCorrectAnswer ?? pattern.meaningVi;

  return (
    <article
      className={`border border-border rounded-xl p-6 sm:p-8 bg-surface relative grid gap-5 shadow-lg transition-all duration-200 ${
        state.isCorrect
          ? "shadow-[0_8px_30px_rgb(16,185,129,0.06)] border-success/30"
          : ""
      }`}
    >
      {/* Header tags and stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-surface-strong border border-border text-muted">
            {pattern.category.replaceAll("_", " ")}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-accent-light text-accent border border-accent/10">
            {pattern.errorType.replaceAll("_", " ")}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-muted text-xs font-medium flex items-center gap-1">
            <History size={12} /> Đã gặp {pattern.occurrenceCount} lần
          </span>
          {state.score !== undefined && (
            <span
              className={`text-sm font-bold px-2 py-0.5 rounded ${
                state.isCorrect
                  ? "bg-success-light text-success border border-success/15"
                  : "bg-danger-light text-danger border border-danger/15"
              }`}
            >
              {state.score}/100 điểm
            </span>
          )}
        </div>
      </div>

      {disclosure.showPreAnswerPrompt ? (
        <div className="rounded-lg p-4 bg-surface-strong border border-border text-sm leading-relaxed flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-muted font-semibold text-xs uppercase tracking-wider">
            <AlertCircle size={14} /> Mẫu lỗi đang được kiểm tra
          </div>
          <div className="text-text mt-0.5">
            Hãy dịch câu mới trước. Nghĩa chuẩn và lỗi cũ sẽ hiện sau khi bạn
            gửi câu trả lời.
          </div>
        </div>
      ) : disclosure.showOldMistakeContext ? (
        <div className="rounded-lg p-4 bg-warning-light/40 border border-warning/15 text-sm leading-relaxed flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-warning font-semibold text-xs uppercase tracking-wider">
            <AlertCircle size={14} /> Gợi ý lỗi sai cũ
          </div>
          <div className="text-text mt-0.5">
            Bạn từng dịch sai cụm từ:{" "}
            <strong className="text-accent font-bold font-mono text-[14px] bg-accent-light px-1.5 py-0.5 rounded border border-accent/10">
              {pattern.normalizedPhrase}
            </strong>
            <span className="text-muted ml-1.5">
              (nghĩa chuẩn:{" "}
              <strong className="font-semibold text-text">
                {pattern.meaningVi}
              </strong>
              )
            </span>
          </div>
        </div>
      ) : null}

      {/* Prompt / Challenge block */}
      <div className="grid gap-3">
        <h3 className="text-base font-bold text-text flex items-center gap-2 m-0">
          <HelpCircle size={16} className="text-accent" /> Yêu cầu dịch:
        </h3>
        <p className="text-muted text-sm m-0 -mt-1 leading-relaxed">
          {renderRichText(promptVi)}
        </p>

        <blockquote className="font-serif text-lg sm:text-xl font-bold text-accent-strong bg-gradient-to-br from-surface to-surface-strong border border-border border-l-4 border-l-accent p-5 rounded-r-xl my-1 leading-relaxed italic shadow-inner">
          {renderRichText(promptEn)}
        </blockquote>
      </div>

      {/* User Input Form */}
      <form action={formAction} className="grid gap-4">
        <input name="patternId" type="hidden" value={pattern.id} />

        <div className="grid gap-2 text-left">
          <label htmlFor="answer" className="text-sm font-semibold text-text">
            Bản dịch tự nhiên của bạn
          </label>
          <textarea
            id="answer"
            disabled={isPending || state.isCorrect}
            name="answer"
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Viết câu dịch tiếng Việt tự nhiên của bạn ở đây..."
            required
            value={answer}
            className="w-full border border-border rounded-xl bg-background text-text px-4 py-3 outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent-light/40 mt-1 min-h-[110px] resize-vertical leading-relaxed disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
          />
        </div>

        {state.error && (
          <div className="inline-flex items-center gap-2 bg-danger-light border border-danger/15 text-danger p-3 rounded-lg text-sm font-medium">
            <AlertCircle size={16} />
            <span>{state.error}</span>
          </div>
        )}

        {/* Action Button */}
        {!state.isCorrect ? (
          <Button
            variant={!canSubmit ? "secondary" : "default"}
            className="w-full h-11 rounded-lg font-semibold text-sm shadow-sm transition-all hover:-translate-y-px"
            disabled={!canSubmit || isPending}
            type="submit"
          >
            {isPending ? (
              <Loader2 className="animate-spin" size={16} aria-hidden="true" />
            ) : (
              <SendHorizontal size={16} aria-hidden="true" />
            )}
            {isPending ? "Đang chấm điểm..." : "Gửi bản dịch"}
          </Button>
        ) : (
          <Button
            className="w-full h-11 rounded-lg font-semibold text-sm bg-accent hover:bg-accent-hover text-white transition-all shadow-[0_4px_12px_rgba(5,150,105,0.15)] hover:-translate-y-px"
            onClick={onComplete}
            type="button"
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            Tiếp tục ôn tập
          </Button>
        )}
      </form>

      {/* Grading Feedback Panel */}
      {state.success && disclosure.showCorrectMeaning && state.feedbackVi && (
        <div
          className={`grid gap-2 border-t border-border pt-4 mt-2 animate-in fade-in slide-in-from-top-3 duration-200 rounded-xl p-5 border ${
            state.isCorrect
              ? "bg-success-light/45 border-success/20"
              : "bg-warning-light/45 border-warning/20"
          }`}
        >
          <div className="flex items-center flex-wrap gap-2">
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                state.isCorrect
                  ? "bg-success/10 text-success"
                  : "bg-warning/10 text-warning"
              }`}
            >
              {state.isCorrect ? "Đạt yêu cầu" : "Cần cải thiện"}
            </span>
            <strong
              className={`text-sm ${state.isCorrect ? "text-success" : "text-warning"}`}
            >
              {state.isCorrect ? "Hoàn thành xuất sắc" : "Gợi ý cải thiện"}
            </strong>
            {!state.isCorrect && state.feedbackDetails?.mistakeType && (
              <span className="inline-flex items-center bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/30">
                {state.feedbackDetails.mistakeType}
              </span>
            )}
          </div>

          <p className="text-sm leading-relaxed m-0 text-text font-medium">
            {renderRichText(state.feedbackVi)}
          </p>

          {!state.isCorrect && state.feedbackDetails ? (
            <div className="grid gap-3 mt-3 text-left">
              <div className="p-3 bg-danger-light border-l-4 border-danger rounded-r-lg text-sm text-text">
                <strong className="text-xs text-danger font-bold block mb-1">
                  Lỗi sai phát hiện:
                </strong>
                {state.feedbackDetails.whatWasWrong}
              </div>

              <div className="p-3 bg-warning-light border-l-4 border-warning rounded-r-lg text-sm text-text">
                <strong className="text-xs text-warning font-bold block mb-1">
                  Lý do nhầm lẫn:
                </strong>
                {state.feedbackDetails.whyItWasWrong}
              </div>

              <div className="p-3 bg-success-light border-l-4 border-success rounded-r-lg text-sm text-text">
                <strong className="text-xs text-success font-bold block mb-1 font-semibold">
                  Hiểu đúng tự nhiên trong ngữ cảnh:
                </strong>
                {state.feedbackDetails.correctUnderstanding}
              </div>

              {state.feedbackDetails.nextPracticeItem && (
                <div className="p-3 bg-accent-light border-l-4 border-accent rounded-r-lg text-sm text-text">
                  <strong className="text-xs text-accent font-bold block mb-1">
                    Luyện tập nhanh:
                  </strong>
                  {state.feedbackDetails.nextPracticeItem}
                </div>
              )}

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
                {showExplainMore && (
                  <div className="p-4 pt-2 text-sm leading-relaxed text-text border-t border-border/30 bg-surface/30">
                    {renderRichText(state.feedbackDetails.detailedExplanation)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-1.5 bg-surface border border-border rounded-lg p-3 mt-1">
              <strong className="text-xs font-bold uppercase tracking-wider text-muted">
                Đáp án tự nhiên
              </strong>
              <p className="text-sm leading-relaxed m-0 text-text font-semibold">
                {renderRichText(naturalAnswer)}
              </p>
            </div>
          )}

          {nextReviewDate ? (
            <p className="text-xs text-muted m-0">
              {state.masteryState === "mastered"
                ? "Mẫu lỗi này đã được đánh dấu thành thạo."
                : `Lần ôn tiếp theo: ${nextReviewDate}.`}
            </p>
          ) : null}
          {!state.isCorrect && (
            <div className="text-xs text-muted border-t border-border/20 pt-2 mt-1 italic">
              Bản dịch vừa thử: &quot;{answer}&quot;
            </div>
          )}
        </div>
      )}
    </article>
  );
}
