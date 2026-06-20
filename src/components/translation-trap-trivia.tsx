"use client";

import { useState } from "react";
import { TRANSLATION_TRIVIA, type TriviaQuestion } from "@/domain/constants";
import { Check, X, HelpCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function TranslationTrapTrivia() {
  const [question, setQuestion] = useState<TriviaQuestion | null>(() => {
    if (TRANSLATION_TRIVIA.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * TRANSLATION_TRIVIA.length);
    return TRANSLATION_TRIVIA[randomIndex];
  });
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  const loadNewQuestion = () => {
    const randomIndex = Math.floor(Math.random() * TRANSLATION_TRIVIA.length);
    setQuestion(TRANSLATION_TRIVIA[randomIndex]);
    setSelectedAnswer(null);
    setHasChecked(false);
  };

  if (!question) return null;

  return (
    <div className="bg-surface border border-border rounded-lg p-5 sm:p-6 shadow-md grid gap-4.5 text-left animate-in fade-in duration-200">
      <div className="flex items-center gap-2 text-accent border-b border-border pb-3">
        <HelpCircle size={18} />
        <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider">
          Góc học hỏi: Tránh bẫy dịch từ (Trivia)
        </span>
      </div>

      <div className="grid gap-2">
        <h4 className="text-sm sm:text-base font-bold text-text m-0 leading-relaxed">
          {question.questionVi}
        </h4>
      </div>

      <div className="grid gap-2.5">
        {question.choices.map((choice, idx) => {
          const isSelected = selectedAnswer === choice;
          const isChoiceCorrect = choice === question.correctAnswer;

          let btnClass =
            "border-border bg-surface text-text hover:bg-surface-strong";
          if (hasChecked) {
            if (isChoiceCorrect) {
              btnClass =
                "border-success bg-success-light/45 text-success-strong font-semibold";
            } else if (isSelected) {
              btnClass = "border-danger bg-danger-light/45 text-danger-strong";
            } else {
              btnClass = "border-border bg-surface text-muted opacity-60";
            }
          } else if (isSelected) {
            btnClass =
              "border-accent bg-accent-light/10 text-accent font-semibold ring-2 ring-accent-light";
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={hasChecked}
              onClick={() => setSelectedAnswer(choice)}
              className={cn(
                "w-full text-left px-4 py-3 rounded-lg border text-sm sm:text-[15px] transition-all duration-200 flex items-center justify-between gap-3",
                !hasChecked && "hover:-translate-y-px cursor-pointer",
                btnClass
              )}
            >
              <span>{choice}</span>
              {hasChecked && isChoiceCorrect && (
                <Check size={16} className="text-success shrink-0" />
              )}
              {hasChecked && isSelected && !isChoiceCorrect && (
                <X size={16} className="text-danger shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {!hasChecked ? (
        <button
          type="button"
          disabled={!selectedAnswer}
          onClick={() => setHasChecked(true)}
          className="w-full h-10 rounded-md bg-accent text-white font-bold text-xs sm:text-sm shadow-sm transition-all hover:bg-accent-hover disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-1.5 mt-1"
        >
          Kiểm tra đáp án
        </button>
      ) : (
        <div className="grid gap-4 mt-1 animate-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-lg bg-surface-strong border border-border p-4 text-xs sm:text-sm leading-relaxed text-text">
            <strong className="block text-accent-strong uppercase font-extrabold text-[10px] tracking-wider mb-1">
              Giải thích ngữ cảnh:
            </strong>
            {question.explanationVi}
          </div>
          <button
            type="button"
            onClick={loadNewQuestion}
            className="inline-flex items-center justify-center gap-1.5 h-10 rounded-md border border-border bg-surface text-text hover:bg-surface-strong font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-sm select-none"
          >
            Câu tiếp theo <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
