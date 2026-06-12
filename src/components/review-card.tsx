"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, SendHorizontal } from "lucide-react";
import { submitReviewAttemptAction, type ReviewResultState } from "@/app/actions/review";
import type { MistakePattern } from "@/db/schema";
import { renderRichText } from "@/lib/rich-text";

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
    <article className={`exercise-card ${state.isCorrect ? "exercise-card-complete" : ""}`} style={{ borderRadius: "var(--radius-md)" }}>
      <div className="exercise-card-topline">
        <div className="cluster">
          <span className="pill">{pattern.category.replaceAll("_", " ")}</span>
          <span className="pill">{pattern.errorType.replaceAll("_", " ")}</span>
          <span className="muted" style={{ fontSize: "12px" }}>Gặp {pattern.occurrenceCount} lần</span>
        </div>
        {state.score !== undefined ? (
          <span className={state.isCorrect ? "status-succeeded" : "status-failed"}>
            Điểm: {state.score}/100
          </span>
        ) : null}
      </div>

      <div className="review-context-notice" style={{ borderRadius: "var(--radius-sm)", padding: "12px 16px", background: "var(--warning-light)", borderLeft: "4px solid var(--warning)", fontSize: "14px", lineHeight: "1.5" }}>
        <span>Bạn từng dịch sai cụm từ:</span>
        <strong style={{ color: "var(--accent-strong)", margin: "0 6px", fontSize: "15px" }}>{pattern.normalizedPhrase}</strong> 
        <span>(nghĩa đúng: <span style={{ fontWeight: "600" }}>{pattern.meaningVi}</span>)</span>
      </div>

      <h3 className="review-prompt-vi" style={{ fontSize: "16px", marginTop: "8px", fontWeight: "600" }}>{renderRichText(promptVi)}</h3>
      <blockquote className="review-prompt-en" style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: "600", color: "var(--accent-strong)", background: "var(--surface-strong)", padding: "14px 18px", borderRadius: "var(--radius-md)", margin: "8px 0" }}>
        {renderRichText(promptEn)}
      </blockquote>

      <form action={formAction} className="stack">
        <input name="patternId" type="hidden" value={pattern.id} />
        
        <label style={{ fontSize: "14px", fontWeight: "600" }}>
          Bản dịch tự nhiên của bạn
          <textarea
            disabled={isPending || state.isCorrect}
            name="answer"
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Viết câu dịch tiếng Việt tự nhiên của bạn ở đây..."
            required
            value={answer}
            style={{ minHeight: "100px", marginTop: "4px" }}
          />
        </label>

        {state.error && (
          <div className="error-banner" style={{ borderRadius: "var(--radius-sm)" }}>
            <AlertCircle size={16} />
            <span>{state.error}</span>
          </div>
        )}

        {!state.isCorrect ? (
          <button
            className="secondary-button exercise-submit-button"
            disabled={!canSubmit || isPending}
            type="submit"
            style={{ marginTop: "8px" }}
          >
            {isPending ? (
              <Loader2 className="spin" size={16} aria-hidden="true" />
            ) : (
              <SendHorizontal size={16} aria-hidden="true" />
            )}
            {isPending ? "Đang chấm..." : "Gửi bản dịch"}
          </button>
        ) : (
          <button
            className="primary-button exercise-submit-button"
            onClick={onComplete}
            type="button"
            style={{ marginTop: "8px" }}
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            Tiếp tục ôn tập
          </button>
        )}
      </form>

      {state.success && state.feedbackVi && (
        <div
          className={`exercise-feedback ${
            state.isCorrect ? "exercise-feedback-correct" : "exercise-feedback-retry"
          }`}
          style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", marginTop: "12px" }}
        >
          <strong style={{ fontSize: "14px" }}>
            {state.isCorrect ? "Hoàn thành xuất sắc" : "Gợi ý cải thiện"}
          </strong>
          <p style={{ fontSize: "14px", lineHeight: "1.5", marginTop: "4px" }}>{renderRichText(state.feedbackVi)}</p>
          {!state.isCorrect && (
            <p className="hint" style={{ fontSize: "12px", marginTop: "6px" }}>Bản dịch vừa thử: {answer}</p>
          )}
        </div>
      )}
    </article>
  );
}
