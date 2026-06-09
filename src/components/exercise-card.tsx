"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2, SendHorizontal, Target } from "lucide-react";
import { submitAttemptAction } from "@/app/actions/attempts";
import type { Attempt, Exercise, KeyPhrase, LessonFocus } from "@/db/schema";
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
}: {
  attempts: Attempt[];
  exercise: Exercise;
  isCurrent?: boolean;
  keyPhrase?: KeyPhrase;
  lessonFocus?: LessonFocus;
}) {
  const latest = attempts[0];
  const solved = Boolean(latest?.isCorrect);
  const needsRetry = Boolean(latest && !latest.isCorrect);
  const [answer, setAnswer] = useState(latest && !latest.isCorrect ? latest.answer : "");
  const statusLabel = solved ? "Done" : needsRetry ? "Needs another try" : isCurrent ? "Up next" : "Not started";
  const canSubmit = answer.trim().length > 0;
  const promptId = `exercise-${exercise.id}-prompt`;
  const feedbackId = `exercise-${exercise.id}-feedback`;
  const submitLabel = needsRetry ? "Try again" : solved ? "Practice again" : "Submit answer";
  const choiceSet = useMemo(() => new Set([exercise.correctAnswer, ...(exercise.acceptableAnswers ?? [])].filter(Boolean)), [exercise]);

  return (
    <article className={`exercise-card ${solved ? "exercise-card-complete" : ""} ${isCurrent ? "exercise-card-current" : ""}`}>
      <div className="exercise-card-topline">
        <div className="cluster">
          <span className="pill">{exercise.type.replaceAll("_", " ")}</span>
          <span className={`exercise-status ${solved ? "exercise-status-done" : needsRetry ? "exercise-status-retry" : ""}`}>
            {solved ? <CheckCircle2 size={15} aria-hidden="true" /> : needsRetry ? <AlertCircle size={15} aria-hidden="true" /> : <Target size={15} aria-hidden="true" />}
            {statusLabel}
          </span>
        </div>
        {latest ? <span className={latest.isCorrect ? "status-succeeded" : "status-failed"}>{latest.score}/100</span> : null}
      </div>
      {keyPhrase ? (
        <a className="exercise-phrase-link" href={`#keyphrase-${keyPhrase.id}`}>
          <span>Practices</span>
          <strong>{keyPhrase.phrase}</strong>
          <span className="pill">{formatLabel(keyPhrase.category)}</span>
          <span className="pill">{keyPhrase.difficulty}</span>
        </a>
      ) : null}
      {lessonFocus ? (
        <a className="exercise-phrase-link" href={`#lessonfocus-${lessonFocus.id}`}>
          <span>Practices</span>
          <strong>{lessonFocus.title}</strong>
          <span className="pill">{formatLabel(lessonFocus.category)}</span>
          <span className="pill">{lessonFocus.difficulty}</span>
        </a>
      ) : null}
      <h3 id={promptId}>{renderRichText(exercise.promptVi)}</h3>
      {exercise.promptEn ? <p>{renderRichText(exercise.promptEn)}</p> : null}
      <form action={submitAttemptAction} className="stack">
        <input name="exerciseId" type="hidden" value={exercise.id} />
        <input name="lessonId" type="hidden" value={exercise.lessonId} />
        {exercise.type === "meaning_choice" && exercise.choices ? (
          <div className="choice-list">
            {exercise.choices.map((choice) => (
              <label className="choice-option" key={choice}>
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
                <span>{renderRichText(choice)}</span>
                {solved && choiceSet.has(choice) ? <CheckCircle2 className="choice-correct-icon" size={15} aria-hidden="true" /> : null}
              </label>
            ))}
          </div>
        ) : (
          <label>
            Your answer
            <textarea
              aria-describedby={latest ? feedbackId : undefined}
              name="answer"
              onChange={(event) => setAnswer(event.target.value)}
              placeholder={needsRetry ? "Thử lại bằng cách giữ nghĩa tự nhiên của cụm trong câu." : "Viết câu trả lời của bạn..."}
              required
              value={answer}
            />
          </label>
        )}
        <SubmitAttemptButton disabled={!canSubmit} label={submitLabel} />
      </form>
      {latest ? (
        <div className={`exercise-feedback ${latest.isCorrect ? "exercise-feedback-correct" : "exercise-feedback-retry"}`} id={feedbackId}>
          <strong>{latest.isCorrect ? "Good read" : "Hint for the next try"}</strong>
          <p>{renderRichText(latest.feedbackVi)}</p>
          {!latest.isCorrect ? <p className="hint">Your last answer: {latest.answer}</p> : null}
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
    >
      {pending ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <SendHorizontal size={16} aria-hidden="true" />}
      {pending ? "Checking..." : label}
    </button>
  );
}
