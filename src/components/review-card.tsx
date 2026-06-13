"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, SendHorizontal } from "lucide-react";
import { submitReviewAttemptAction, type ReviewResultState } from "@/app/actions/review";
import type { MistakePattern } from "@/domain/memory";
import { renderRichText } from "@/lib/rich-text";
import { Button } from "@/components/ui/button";

export function ReviewCard({
  pattern,
  onComplete,
}: {
  pattern: MistakePattern;
  onComplete: () => void;
}) {
  const [answer, setAnswer] = useState("");
  
  const [state, formAction, isPending] = useActionState<ReviewResultState, FormData>(
    submitReviewAttemptAction,
    {}
  );

  const promptEn = pattern.reviewPromptEn ?? pattern.normalizedPhrase;
  const promptVi = pattern.reviewPromptVi ?? `Dịch cụm từ hoặc câu sau sang nghĩa tự nhiên: "${pattern.normalizedPhrase}"`;
  const canSubmit = answer.trim().length > 0;

  return (
    <article className={`border border-border rounded-md p-4 bg-surface relative grid gap-3 transition-all ${
      state.isCorrect ? "bg-gradient-to-b from-surface to-surface-strong" : ""
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-xs font-extrabold leading-none">
            {pattern.category.replaceAll("_", " ")}
          </span>
          <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-xs font-extrabold leading-none">
            {pattern.errorType.replaceAll("_", " ")}
          </span>
          <span className="text-muted text-xs leading-none">Gặp {pattern.occurrenceCount} lần</span>
        </div>
        {state.score !== undefined ? (
          <span className={`text-sm font-semibold leading-none ${state.isCorrect ? "text-success" : "text-danger"}`}>
            Điểm: {state.score}/100
          </span>
        ) : null}
      </div>

      <div className="rounded-sm p-3 px-4 bg-warning-light border-l-4 border-warning text-sm leading-relaxed flex flex-wrap items-center gap-1.5">
        <span>Bạn từng dịch sai cụm từ:</span>
        <strong className="text-accent-strong mx-1.5 text-[15px] font-bold">{pattern.normalizedPhrase}</strong> 
        <span>(nghĩa đúng: <span className="font-semibold">{pattern.meaningVi}</span>)</span>
      </div>

      <h3 className="text-base mt-2 font-semibold text-text leading-normal m-0">{renderRichText(promptVi)}</h3>
      <blockquote className="font-serif text-lg font-semibold text-accent-strong bg-surface-strong p-3.5 px-4.5 rounded-md my-2 leading-relaxed">
        {renderRichText(promptEn)}
      </blockquote>

      <form action={formAction} className="grid gap-5 mt-0.5">
        <input name="patternId" type="hidden" value={pattern.id} />
        
        <label className="grid gap-2 text-left text-sm font-semibold text-text">
          Bản dịch tự nhiên của bạn
          <textarea
            disabled={isPending || state.isCorrect}
            name="answer"
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Viết câu dịch tiếng Việt tự nhiên của bạn ở đây..."
            required
            value={answer}
            className="w-full border border-border rounded-md bg-surface text-text px-4 py-3 outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent-light mt-1 min-h-[100px] resize-vertical leading-relaxed disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>

        {state.error && (
          <div className="inline-flex items-center gap-2 bg-[#fff5f4] border border-#f2b8b5 text-danger p-2 px-3 rounded-md text-xs sm:text-sm">
            <AlertCircle size={16} />
            <span>{state.error}</span>
          </div>
        )}

        {!state.isCorrect ? (
          <Button
            variant={!canSubmit ? "secondary" : "default"}
            className="w-full mt-2 h-11"
            disabled={!canSubmit || isPending}
            type="submit"
          >
            {isPending ? (
              <Loader2 className="animate-spin" size={16} aria-hidden="true" />
            ) : (
              <SendHorizontal size={16} aria-hidden="true" />
            )}
            {isPending ? "Đang chấm..." : "Gửi bản dịch"}
          </Button>
        ) : (
          <Button
            className="w-full mt-2 h-11"
            onClick={onComplete}
            type="button"
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            Tiếp tục ôn tập
          </Button>
        )}
      </form>

      {state.success && state.feedbackVi && (
        <div className="grid gap-1.5 border-t border-border pt-3.5 mt-3">
          <strong className={`text-sm ${state.isCorrect ? "text-success" : "text-warning"}`}>
            {state.isCorrect ? "Hoàn thành xuất sắc" : "Gợi ý cải thiện"}
          </strong>
          <p className="text-sm leading-relaxed m-0 mt-1">{renderRichText(state.feedbackVi)}</p>
          {!state.isCorrect && (
            <p className="text-xs text-muted mt-1.5">Bản dịch vừa thử: {answer}</p>
          )}
        </div>
      )}
    </article>
  );
}
