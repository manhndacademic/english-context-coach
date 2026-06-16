"use client";

import { useActionState, useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Loader2,
  SendHorizontal,
  HelpCircle,
  History,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import {
  submitReviewAttemptAction,
  type ReviewResultState,
} from "@/app/actions/review";
import type { MistakePatternPlain } from "@/domain/memory";
import { renderRichText } from "@/lib/rich-text";
import { Button } from "@/components/ui/button";
import { getReviewDisclosureState } from "@/components/review-disclosure";
import { GradingFeedback } from "@/components/grading-feedback";

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
  lessons,
  onComplete,
}: {
  pattern: MistakePatternPlain;
  lessons?: Array<{ id: string; title: string | null }>;
  onComplete: () => void;
}) {
  const [answer, setAnswer] = useState("");

  const [state, formAction, isPending] = useActionState<
    ReviewResultState,
    FormData
  >(submitReviewAttemptAction, {});

  const isChoiceType =
    pattern.reviewType === "meaning_choice" ||
    pattern.reviewType === "trap_choice" ||
    pattern.reviewType === "trap_detect";

  const choiceSet = useMemo(
    () =>
      new Set(
        [
          pattern.reviewCorrectAnswer,
          ...(pattern.reviewAcceptableAnswers ?? []),
        ].filter(Boolean)
      ),
    [pattern]
  );

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

      {lessons && lessons.length > 0 && (
        <div className="flex flex-col gap-1 bg-surface-strong/60 p-2.5 rounded-lg border border-border text-xs">
          <span className="text-[10px] text-muted font-bold tracking-wider uppercase flex items-center gap-1">
            <ExternalLink size={10} /> Gặp lỗi này trong các bài học:
          </span>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-1">
            {lessons.map((l) => (
              <Link
                key={l.id}
                href={`/lessons/${l.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-accent hover:underline font-bold"
              >
                {l.title || "Bài học gốc"}
              </Link>
            ))}
          </div>
        </div>
      )}

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

        {isChoiceType ? (
          <div className="grid gap-2 text-left">
            <span className="text-sm font-semibold text-text">
              Chọn câu trả lời đúng
            </span>
            <div className="grid gap-2 mt-1">
              {pattern.reviewChoices?.map((choice, index) => {
                const isChoiceCorrect = choiceSet.has(choice);
                const isSelected = answer === choice;
                const showSuccess = state.isCorrect && isChoiceCorrect;
                return (
                  <label
                    key={`${pattern.id}-choice-${index}`}
                    className={`flex items-center gap-3 p-3 px-4 rounded-xl border text-left cursor-pointer transition-all ${
                      showSuccess
                        ? "bg-success-light border-success text-success font-semibold"
                        : isSelected
                          ? "border-accent bg-accent-light/30 ring-2 ring-accent/30 font-medium"
                          : "border-border hover:bg-surface-active"
                    }`}
                  >
                    <input
                      disabled={isPending || state.isCorrect}
                      name="answer"
                      required
                      type="radio"
                      value={choice}
                      checked={isSelected}
                      onChange={(event) => setAnswer(event.target.value)}
                      className="accent-accent disabled:opacity-50"
                    />
                    <span className="text-sm md:text-[15px]">
                      {renderRichText(choice)}
                    </span>
                    {showSuccess ? (
                      <CheckCircle2
                        className="ml-auto text-success shrink-0"
                        size={15}
                        aria-hidden="true"
                      />
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>
        ) : (
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
        )}

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
            {isPending
              ? "Đang chấm điểm..."
              : isChoiceType
                ? "Gửi câu trả lời"
                : "Gửi bản dịch"}
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
      {state.success && disclosure.showCorrectMeaning && state.feedbackVi ? (
        <GradingFeedback
          type="review"
          isCorrect={state.isCorrect ?? false}
          feedbackVi={state.feedbackVi}
          answer={answer}
          feedbackDetails={state.feedbackDetails}
          naturalAnswer={naturalAnswer}
          nextReviewDate={nextReviewDate}
          masteryState={state.masteryState}
          isSubjectiveType={!isChoiceType}
        />
      ) : null}
    </article>
  );
}
