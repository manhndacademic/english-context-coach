"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  SendHorizontal,
  Target,
} from "lucide-react";
import { submitAttemptAction } from "@/app/actions/attempts";
import { ExercisePractice } from "@/domain/memory/exercise-practice";
import { renderRichText } from "@/lib/rich-text";
import { GradingFeedback } from "@/components/grading-feedback";
import {
  getExerciseStatusView,
  getExerciseTypeLabel,
  getExercisePlaceholder,
  getChoiceStyle,
  type ExerciseStatus,
} from "@/domain/memory/exercise-view-presenter";

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function ExerciseCard({
  practice,
  isCurrent = false,
  onNext,
}: {
  practice: ExercisePractice;
  isCurrent?: boolean;
  onNext?: () => void;
}) {
  const { exercise, attempts, keyPhrase, lessonFocus, userError } = practice;
  const latest = attempts[0];
  const solved = practice.isSolved;
  const needsRetry = practice.needsRetry;
  const showSuggestion = needsRetry && attempts.length >= 2;
  const [answer, setAnswer] = useState(
    latest && !latest.isCorrect ? latest.answer : ""
  );
  const [isPracticingAgain, setIsPracticingAgain] = useState(false);

  const isInputDisabled =
    (solved && !isPracticingAgain) ||
    (attempts.length >= 2 && !isPracticingAgain);

  const status: ExerciseStatus = solved
    ? "solved"
    : needsRetry
      ? "needs-retry"
      : isCurrent
        ? "current"
        : "upcoming";
  const {
    label: statusLabel,
    className: statusClassName,
    iconType: statusIconType,
  } = getExerciseStatusView(status);
  const canSubmit = answer.trim().length > 0;
  const promptId = `exercise-${exercise.id}-prompt`;
  const submitLabel = needsRetry ? "Thử lại" : "Gửi câu trả lời";
  const choiceSet = useMemo(
    () =>
      new Set(
        [exercise.correctAnswer, ...(exercise.acceptableAnswers ?? [])].filter(
          Boolean
        )
      ),
    [exercise]
  );

  const isRepeated =
    latest && !latest.isCorrect ? Boolean(userError?.isRepeated) : false;

  const metadata = latest?.gradingMetadata as
    | {
        naturalAnswer?: string;
        literalTranslationTrap?: string;
        feedbackDetails?: {
          whatWasWrong: string;
          whyItWasWrong: string;
          correctUnderstanding: string;
          mistakeType: string;
          nextPracticeItem?: string | null;
          detailedExplanation: string;
        } | null;
      }
    | null
    | undefined;

  const typeLabel = getExerciseTypeLabel(exercise.type);

  const isChoiceType =
    exercise.type === "meaning_choice" ||
    exercise.type === "trap_choice" ||
    exercise.type === "trap_detect";
  const isObjectiveType =
    exercise.type === "cloze_phrase" ||
    exercise.type === "meaning_choice" ||
    exercise.type === "trap_choice" ||
    exercise.type === "trap_detect";
  const isSubjectiveType = !isObjectiveType;
  const shouldShowKeyPhrase = keyPhrase && (!isObjectiveType || solved);

  // Keyboard numeric shortcuts for multiple-choice selections when exercise is current
  useEffect(() => {
    if (!isCurrent || solved || !isChoiceType || !exercise.choices) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "TEXTAREA" ||
          (activeEl.tagName === "INPUT" &&
            (activeEl as HTMLInputElement).type !== "radio") ||
          activeEl.hasAttribute("contenteditable"))
      ) {
        return;
      }

      const keyNum = parseInt(event.key, 10);
      if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= exercise.choices!.length) {
        event.preventDefault();
        const selectedChoice = exercise.choices![keyNum - 1];
        if (selectedChoice) {
          setAnswer(selectedChoice);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCurrent, solved, isChoiceType, exercise.choices]);

  const formattedPromptEn = useMemo(() => {
    if (!exercise.promptEn) return "";
    return exercise.promptEn.replace(/(?:_\s*){3,}_/g, "_______");
  }, [exercise.promptEn]);

  return (
    <article
      className={`border border-border rounded-md p-4 bg-surface relative grid gap-3 transition-all ${
        solved ? "bg-gradient-to-b from-surface to-surface-strong" : ""
      } ${isCurrent ? "border-accent ring-3 ring-accent-light" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-xs font-extrabold leading-none">
            {typeLabel}
          </span>
          <span
            className={`inline-flex items-center gap-1 w-fit rounded-full px-2.5 py-1 text-xs font-extrabold border leading-none ${statusClassName}`}
          >
            {statusIconType === "solved" ? (
              <CheckCircle2 size={15} aria-hidden="true" />
            ) : statusIconType === "retry" ? (
              <AlertCircle size={15} aria-hidden="true" />
            ) : (
              <Target size={15} aria-hidden="true" />
            )}
            {statusLabel}
          </span>
        </div>
        {latest ? (
          <span
            className={`text-sm font-semibold leading-none ${latest.isCorrect ? "text-success" : "text-danger"}`}
          >
            {latest.score}/100
          </span>
        ) : null}
      </div>

      {shouldShowKeyPhrase ? (
        <a
          className="flex flex-wrap items-center gap-1.5 w-fit mt-3 text-muted text-[13px] font-bold no-underline hover:text-text transition-colors"
          href={`#keyphrase-${keyPhrase.id}`}
        >
          <span>Luyện tập cụm từ:</span>
          <strong>{keyPhrase.phrase}</strong>
          <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-[10px] font-extrabold leading-none">
            {formatLabel(keyPhrase.category)}
          </span>
          <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-[10px] font-extrabold leading-none">
            {keyPhrase.difficulty}
          </span>
        </a>
      ) : lessonFocus ? (
        <a
          className="flex flex-wrap items-center gap-1.5 w-fit mt-3 text-muted text-[13px] font-bold no-underline hover:text-text transition-colors"
          href={`#lessonfocus-${lessonFocus.id}`}
        >
          <span>Lưu ý:</span>
          <strong>{lessonFocus.title}</strong>
          <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-[10px] font-extrabold leading-none">
            {formatLabel(lessonFocus.category)}
          </span>
          <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-[10px] font-extrabold leading-none">
            {lessonFocus.difficulty}
          </span>
        </a>
      ) : null}

      <div
        className="text-sm md:text-base leading-relaxed text-text mt-2 font-serif text-left"
        id={promptId}
      >
        {renderRichText(formattedPromptEn)}
      </div>

      <form
        id={`exercise-form-${exercise.id}`}
        action={async (formData) => {
          await submitAttemptAction(formData);
          setIsPracticingAgain(false);
          if (isChoiceType) {
            setAnswer("");
          }
        }}
        className="grid gap-3"
      >
        <input name="exerciseId" type="hidden" value={exercise.id} />
        <input name="lessonId" type="hidden" value={exercise.lessonId} />
        {exercise.promptVi ? (
          <p className="text-xs text-muted leading-relaxed m-0 text-left">
            {exercise.promptVi}
          </p>
        ) : null}
        {isChoiceType ? (
          <div className="grid gap-2 mt-2">
            {exercise.choices?.map((choice, index) => (
              <label
                key={`${exercise.id}-choice-${index}`}
                className={`flex items-center gap-3 p-3 px-4 rounded-md border text-left cursor-pointer transition-all ${getChoiceStyle(
                  {
                    choice,
                    answer,
                    solved,
                    isPracticingAgain,
                    isCorrectChoice: choiceSet.has(choice),
                  }
                )}`}
              >
                <input
                  disabled={isInputDisabled}
                  name="answer"
                  required
                  type="radio"
                  value={choice}
                  checked={answer === choice}
                  onChange={(event) => setAnswer(event.target.value)}
                  className="accent-accent disabled:opacity-50"
                />
                <span className="text-sm md:text-[15px]">
                  {renderRichText(choice)}
                </span>
                {solved && !isPracticingAgain && choiceSet.has(choice) ? (
                  <CheckCircle2
                    className="ml-auto text-success shrink-0"
                    size={15}
                    aria-hidden="true"
                  />
                ) : null}
              </label>
            ))}
          </div>
        ) : (
          <label className="grid gap-2 text-left text-sm font-semibold text-text mt-2">
            Câu trả lời của bạn
            <textarea
              name="answer"
              disabled={isInputDisabled}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder={getExercisePlaceholder(exercise.type, needsRetry)}
              required
              value={answer}
              className="w-full border border-border rounded-md bg-surface text-text px-4 py-3 outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent-light mt-1 min-h-[100px] resize-vertical leading-relaxed disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
        )}
        {solved && !isPracticingAgain ? (
          <button
            type="button"
            onClick={() => {
              setIsPracticingAgain(true);
              setAnswer("");
            }}
            className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-transparent px-5 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer mt-3 w-fit"
          >
            Luyện tập lại
          </button>
        ) : (
          (!latest || isPracticingAgain) && (
            <SubmitAttemptButton disabled={!canSubmit} label={submitLabel} />
          )
        )}
      </form>

      {latest ? (
        <div className="grid gap-3">
          <GradingFeedback
            type="exercise"
            isCorrect={latest.isCorrect ?? false}
            feedbackVi={latest.feedbackVi ?? ""}
            answer={latest.answer ?? ""}
            feedbackDetails={metadata?.feedbackDetails}
            naturalAnswer={metadata?.naturalAnswer}
            literalTranslationTrap={metadata?.literalTranslationTrap}
            solved={solved}
            isSubjectiveType={isSubjectiveType}
            isRepeated={isRepeated}
            showSuggestion={showSuggestion}
            score={latest.score ?? undefined}
          />
          {!latest.isCorrect && !isPracticingAgain && (
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {attempts.length === 1 && (
                <button
                  form={`exercise-form-${exercise.id}`}
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-transparent px-5 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px cursor-pointer"
                >
                  Thử lại 1 lần
                </button>
              )}
              <button
                type="button"
                onClick={onNext}
                className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-border bg-surface text-text hover:bg-surface-strong px-5 font-semibold text-sm transition-all shadow-sm cursor-pointer"
              >
                Đi tiếp →
              </button>
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

function SubmitAttemptButton({
  disabled,
  label,
}: {
  disabled: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-transparent px-5 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer mt-3"
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? (
        <Loader2 className="animate-spin" size={16} aria-hidden="true" />
      ) : (
        <SendHorizontal size={16} aria-hidden="true" />
      )}
      {pending ? "Đang chấm..." : label}
    </button>
  );
}
