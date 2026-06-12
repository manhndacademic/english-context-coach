"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2, SendHorizontal, Target } from "lucide-react";
import { submitAttemptAction } from "@/app/actions/attempts";
import type { Exercise, KeyPhrase, LessonFocus } from "@/domain/lesson";
import type { Attempt } from "@/domain/memory";
import { renderRichText } from "@/lib/rich-text";

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function ExerciseCard({
  attempts,
  exercise,
  isCurrent = false,
  keyPhrase,
  lessonFocus,
  userErrorsByAttemptId,
}: {
  attempts: Attempt[];
  exercise: Exercise;
  isCurrent?: boolean;
  keyPhrase?: KeyPhrase;
  lessonFocus?: LessonFocus;
  userErrorsByAttemptId?: Map<string, any>;
}) {
  const latest = attempts[0];
  const solved = Boolean(latest?.isCorrect);
  const needsRetry = Boolean(latest && !latest.isCorrect);
  const [answer, setAnswer] = useState(latest && !latest.isCorrect ? latest.answer : "");
  const statusLabel = solved ? "Đã xong" : needsRetry ? "Cần thử lại" : isCurrent ? "Lượt tiếp theo" : "Chưa bắt đầu";
  const canSubmit = answer.trim().length > 0;
  const promptId = `exercise-${exercise.id}-prompt`;
  const feedbackId = `exercise-${exercise.id}-feedback`;
  const submitLabel = needsRetry ? "Thử lại" : solved ? "Luyện tập lại" : "Gửi câu trả lời";
  const choiceSet = useMemo(() => new Set([exercise.correctAnswer, ...(exercise.acceptableAnswers ?? [])].filter(Boolean)), [exercise]);
  const isRepeated = latest && !latest.isCorrect ? Boolean(userErrorsByAttemptId?.get(latest.id)?.isRepeated) : false;
  const metadata = latest?.gradingMetadata as {
    naturalAnswer?: string;
    literalTranslationTrap?: string;
  } | null | undefined;

  const typeLabel = exercise.type === "meaning_choice" ? "Trắc nghiệm nghĩa" : "Dịch tự nhiên";

  return (
    <article className={`exercise-card ${solved ? "exercise-card-complete" : ""} ${isCurrent ? "exercise-card-current" : ""}`} style={{ borderRadius: "var(--radius-md)" }}>
      <div className="exercise-card-topline">
        <div className="cluster">
          <span className="pill">{typeLabel}</span>
          <span className={`exercise-status ${solved ? "exercise-status-done" : needsRetry ? "exercise-status-retry" : ""}`} style={{ borderRadius: "var(--radius-sm)" }}>
            {solved ? <CheckCircle2 size={15} aria-hidden="true" /> : needsRetry ? <AlertCircle size={15} aria-hidden="true" /> : <Target size={15} aria-hidden="true" />}
            {statusLabel}
          </span>
        </div>
        {latest ? <span className={latest.isCorrect ? "status-succeeded" : "status-failed"}>{latest.score}/100</span> : null}
      </div>
      {keyPhrase ? (
        <a className="exercise-phrase-link" href={`#keyphrase-${keyPhrase.id}`} style={{ fontSize: "13px" }}>
          <span>Luyện tập cụm từ:</span>
          <strong>{keyPhrase.phrase}</strong>
          <span className="pill">{formatLabel(keyPhrase.category)}</span>
          <span className="pill">{keyPhrase.difficulty}</span>
        </a>
      ) : null}
      {lessonFocus ? (
        <a className="exercise-phrase-link" href={`#lessonfocus-${lessonFocus.id}`} style={{ fontSize: "13px" }}>
          <span>Luyện tập chủ điểm:</span>
          <strong>{lessonFocus.title}</strong>
          <span className="pill">{formatLabel(lessonFocus.category)}</span>
          <span className="pill">{lessonFocus.difficulty}</span>
        </a>
      ) : null}
      <h3 id={promptId} style={{ fontSize: "18px", marginTop: "8px", fontWeight: "600", color: "var(--text)" }}>{renderRichText(exercise.promptVi)}</h3>
      {exercise.promptEn ? <p style={{ fontFamily: "var(--font-serif)", fontSize: "16px", fontStyle: "italic", color: "var(--muted)", margin: "4px 0" }}>{renderRichText(exercise.promptEn)}</p> : null}
      <form action={submitAttemptAction} className="stack">
        <input name="exerciseId" type="hidden" value={exercise.id} />
        <input name="lessonId" type="hidden" value={exercise.lessonId} />
        {exercise.type === "meaning_choice" && exercise.choices ? (
          <div className="choice-list" style={{ marginTop: "8px" }}>
            {exercise.choices.map((choice) => (
              <label className="choice-option" key={choice} style={{ borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                <input
                  aria-describedby={latest ? feedbackId : undefined}
                  aria-labelledby={promptId}
                  checked={answer === choice}
                  name="answer"
                  onChange={() => setAnswer(choice)}
                  type="radio"
                  value={choice}
                  required
                />
                <span style={{ fontSize: "15px" }}>{renderRichText(choice)}</span>
                {solved && choiceSet.has(choice) ? <CheckCircle2 className="choice-correct-icon" size={15} aria-hidden="true" /> : null}
              </label>
            ))}
          </div>
        ) : (
          <label style={{ fontSize: "14px", fontWeight: "600", marginTop: "8px" }}>
            Câu trả lời của bạn
            <textarea
              aria-describedby={latest ? feedbackId : undefined}
              name="answer"
              onChange={(event) => setAnswer(event.target.value)}
              placeholder={needsRetry ? "Thử lại bằng cách giữ nghĩa tự nhiên của cụm trong câu..." : "Viết câu dịch tiếng Việt tự nhiên của bạn..."}
              required
              value={answer}
              style={{ minHeight: "100px", marginTop: "4px" }}
            />
          </label>
        )}
        <SubmitAttemptButton disabled={!canSubmit} label={submitLabel} />
      </form>
      {latest ? (
        <div className={`exercise-feedback ${latest.isCorrect ? "exercise-feedback-correct" : "exercise-feedback-retry"}`} id={feedbackId} style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", marginTop: "8px" }}>
          <strong style={{ fontSize: "14px" }}>{latest.isCorrect ? "Chính xác" : "Gợi ý cải thiện"}</strong>
          <p style={{ fontSize: "14px", color: "var(--text)", lineHeight: "1.5", marginTop: "4px" }}>{renderRichText(latest.feedbackVi)}</p>
          {metadata?.naturalAnswer && (
            <div className="feedback-natural-answer" style={{ marginTop: '12px', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--success-light)', borderLeft: '4px solid var(--success)' }}>
              <strong style={{ fontSize: '13px', color: 'var(--success)' }}>Dịch nghĩa tự nhiên gợi ý</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '15px', lineHeight: '1.4', fontWeight: "500" }}>{metadata.naturalAnswer}</p>
            </div>
          )}
          {!latest.isCorrect && metadata?.literalTranslationTrap && (
            <div className="feedback-literal-trap" style={{ marginTop: '12px', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-light)', borderLeft: '4px solid var(--danger)' }}>
              <strong style={{ fontSize: '13px', color: 'var(--danger)' }}>Bẫy dịch từng từ (Literal Trap)</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '15px', lineHeight: '1.4' }}>
                Tránh dịch: <span style={{ textDecoration: 'line-through', opacity: "0.8" }}>&quot;{metadata.literalTranslationTrap}&quot;</span>
              </p>
            </div>
          )}
          {!latest.isCorrect ? <p className="hint" style={{ marginTop: '8px', fontSize: "12px" }}>Bản dịch vừa gửi: {latest.answer}</p> : null}
          {isRepeated && (
            <div className="repeated-mistake-warning">
              <AlertCircle size={14} aria-hidden="true" />
              <span>Bạn đã từng gặp lỗi này trước đây.</span>
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

function SubmitAttemptButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="secondary-button exercise-submit-button"
      disabled={disabled || pending}
      type="submit"
      style={{ marginTop: "12px" }}
    >
      {pending ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <SendHorizontal size={16} aria-hidden="true" />}
      {pending ? "Đang chấm..." : label}
    </button>
  );
}
