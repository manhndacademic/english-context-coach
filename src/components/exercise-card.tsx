"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  SendHorizontal,
  Target,
} from "lucide-react";
import { submitAttemptAction } from "@/app/actions/attempts";
import type { Exercise, KeyPhrase, LessonFocus } from "@/domain/lesson";
import type { Attempt } from "@/domain/memory";
import { renderRichText } from "@/lib/rich-text";

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function getExerciseTypeLabel(type: string) {
  switch (type) {
    case "meaning_choice":
      return "Chọn nghĩa đúng";
    case "cloze_phrase":
      return "Điền vào chỗ trống";
    case "natural_translation":
      return "Dịch sang tiếng Việt";
    case "focus_question":
      return "Câu hỏi trọng tâm";
    case "trap_choice":
      return "Tránh bẫy dịch";
    case "phrase_production":
      return "Đặt câu tiếng Anh";
    case "dialogue_completion":
      return "Hoàn thành hội thoại";
    case "register_shift":
      return "Viết lại tự nhiên hơn";
    case "trap_detect":
      return "Phát hiện bẫy dịch";
    default:
      return "Luyện tập";
  }
}

function getPlaceholder(type: string, needsRetry: boolean) {
  if (needsRetry) {
    return "Thử lại...";
  }
  switch (type) {
    case "cloze_phrase":
      return "Điền từ hoặc cụm từ phù hợp vào chỗ trống...";
    case "phrase_production":
      return "Viết câu tiếng Anh hoàn chỉnh chứa cụm từ...";
    case "dialogue_completion":
      return "Viết câu phản hồi tiếng Anh của B có chứa cụm từ...";
    case "register_shift":
      return "Viết lại câu tiếng Anh tự nhiên/idiomatic hơn...";
    case "natural_translation":
    case "focus_question":
    default:
      return "Viết câu dịch hoặc câu trả lời tiếng Việt tự nhiên của bạn...";
  }
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
  const [answer, setAnswer] = useState(
    latest && !latest.isCorrect ? latest.answer : ""
  );
  const statusLabel = solved
    ? "Đã xong"
    : needsRetry
      ? "Cần thử lại"
      : isCurrent
        ? "Lượt tiếp theo"
        : "Chưa bắt đầu";
  const canSubmit = answer.trim().length > 0;
  const promptId = `exercise-${exercise.id}-prompt`;
  const feedbackId = `exercise-${exercise.id}-feedback`;
  const submitLabel = needsRetry
    ? "Thử lại"
    : solved
      ? "Luyện tập lại"
      : "Gửi câu trả lời";
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
    latest && !latest.isCorrect
      ? Boolean(userErrorsByAttemptId?.get(latest.id)?.isRepeated)
      : false;
  const metadata = latest?.gradingMetadata as
    | {
        naturalAnswer?: string;
        literalTranslationTrap?: string;
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
            className={`inline-flex items-center gap-1 w-fit rounded-full px-2.5 py-1 text-xs font-extrabold border leading-none ${
              solved
                ? "bg-success-light border-success text-success"
                : needsRetry
                  ? "bg-danger-light border-danger text-danger"
                  : "bg-surface-strong border-border text-muted"
            }`}
          >
            {solved ? (
              <CheckCircle2 size={15} aria-hidden="true" />
            ) : needsRetry ? (
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
      ) : null}

      {lessonFocus ? (
        <a
          className="flex flex-wrap items-center gap-1.5 w-fit mt-3 text-muted text-[13px] font-bold no-underline hover:text-text transition-colors"
          href={`#lessonfocus-${lessonFocus.id}`}
        >
          <span>Luyện tập chủ điểm:</span>
          <strong>{lessonFocus.title}</strong>
          <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-[10px] font-extrabold leading-none">
            {formatLabel(lessonFocus.category)}
          </span>
          <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-[10px] font-extrabold leading-none">
            {lessonFocus.difficulty}
          </span>
        </a>
      ) : null}

      <h3 id={promptId} className="text-lg mt-2 font-semibold text-text m-0">
        {renderRichText(exercise.promptVi)}
      </h3>

      {exercise.promptEn ? (
        <p className="font-serif text-sm md:text-base italic text-muted my-1 m-0">
          {renderRichText(exercise.promptEn)}
        </p>
      ) : null}

      <form action={submitAttemptAction} className="grid gap-5">
        <input name="exerciseId" type="hidden" value={exercise.id} />
        <input name="lessonId" type="hidden" value={exercise.lessonId} />

        {isChoiceType && exercise.choices ? (
          <div className="grid gap-2 mt-2">
            {exercise.choices.map((choice) => (
              <label
                className="relative flex items-center gap-2.5 min-h-[42px] border border-border rounded-sm bg-surface p-2.5 px-3 font-semibold transition-all cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-success-light has-[:checked]:ring-3 has-[:checked]:ring-accent-light"
                key={choice}
              >
                <input
                  aria-describedby={latest ? feedbackId : undefined}
                  aria-labelledby={promptId}
                  checked={answer === choice}
                  name="answer"
                  onChange={() => setAnswer(choice)}
                  type="radio"
                  value={choice}
                  required
                  className="w-auto h-auto p-0 m-0 border-none bg-none shadow-none accent-accent shrink-0 focus:outline-none focus:ring-0"
                />
                <span className="text-sm md:text-[15px]">
                  {renderRichText(choice)}
                </span>
                {solved && choiceSet.has(choice) ? (
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
              aria-describedby={latest ? feedbackId : undefined}
              name="answer"
              onChange={(event) => setAnswer(event.target.value)}
              placeholder={getPlaceholder(exercise.type, needsRetry)}
              required
              value={answer}
              className="w-full border border-border rounded-md bg-surface text-text px-4 py-3 outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent-light mt-1 min-h-[100px] resize-vertical leading-relaxed disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
        )}
        <SubmitAttemptButton disabled={!canSubmit} label={submitLabel} />
      </form>

      {latest ? (
        <div
          className="grid gap-1.5 border-t border-border pt-4 mt-2"
          id={feedbackId}
        >
          <strong className="text-sm font-bold">
            {latest.isCorrect ? "Chính xác" : "Gợi ý cải thiện"}
          </strong>
          <p className="text-sm text-text leading-relaxed m-0 mt-1">
            {renderRichText(latest.feedbackVi)}
          </p>

          {metadata?.naturalAnswer && (solved || isSubjectiveType) && (
            <div className="mt-3 p-3 px-4 rounded-md bg-success-light border-l-4 border-success">
              <strong className="text-xs font-bold text-success block">
                Gợi ý
              </strong>
              <p className="m-0 mt-1 text-sm md:text-base leading-relaxed font-semibold">
                {metadata.naturalAnswer}
              </p>
            </div>
          )}

          {!latest.isCorrect && metadata?.literalTranslationTrap && (
            <div className="mt-3 p-3 px-4 rounded-md bg-danger-light border-l-4 border-danger">
              <strong className="text-xs font-bold text-danger block">
                Bẫy dịch từng từ (Literal Trap)
              </strong>
              <p className="m-0 mt-1 text-sm md:text-base leading-relaxed">
                Tránh dịch:{" "}
                <span className="line-through opacity-80">
                  &quot;{metadata.literalTranslationTrap}&quot;
                </span>
              </p>
            </div>
          )}

          {!latest.isCorrect ? (
            <p className="text-xs text-muted mt-1.5">
              Câu trả lời vừa gửi: {latest.answer}
            </p>
          ) : null}

          {isRepeated && (
            <div className="flex items-center gap-2 bg-[#fff5f4] border border-[#f2b8b5] text-danger p-2 px-3 rounded-md text-xs sm:text-sm mt-3">
              <AlertCircle size={14} aria-hidden="true" />
              <span>Bạn đã từng gặp lỗi này trước đây.</span>
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
