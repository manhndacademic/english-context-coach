import { renderRichText } from "@/lib/rich-text";
import { WordDiff } from "@/components/lesson/WordDiff";

export interface AnswerSuggestionsProps {
  isReview: boolean;
  isCorrect: boolean;
  naturalAnswer?: string | null;
  solved?: boolean;
  isSubjectiveType?: boolean;
  showSuggestion?: boolean;
  literalTranslationTrap?: string | null;
  answer: string;
}

export function AnswerSuggestions({
  isReview,
  isCorrect,
  naturalAnswer,
  solved,
  isSubjectiveType,
  showSuggestion,
  literalTranslationTrap,
  answer,
}: AnswerSuggestionsProps) {
  return (
    <>
      {isReview ? (
        naturalAnswer ? (
          <div className="grid gap-1.5 bg-surface border border-border rounded-lg p-3 mt-1 text-left">
            <strong className="text-xs font-bold uppercase tracking-wider text-muted">
              Đáp án tự nhiên
            </strong>
            <div className="text-sm leading-relaxed m-0 text-text font-semibold">
              {isSubjectiveType && !isCorrect ? (
                <WordDiff original={answer} corrected={naturalAnswer} />
              ) : (
                renderRichText(naturalAnswer)
              )}
            </div>
          </div>
        ) : null
      ) : (
        <>
          {naturalAnswer && solved && isSubjectiveType ? (
            <div className="mt-3 p-3 px-4 rounded-md bg-success-light border-l-4 border-success text-left">
              <strong className="text-xs font-bold text-success block">
                Cách diễn đạt tự nhiên
              </strong>
              <p className="m-0 mt-1 text-sm md:text-base leading-relaxed font-semibold">
                {naturalAnswer}
              </p>
            </div>
          ) : null}

          {naturalAnswer && !solved && showSuggestion ? (
            <div className="mt-3 p-3 px-4 rounded-md bg-accent-light border-l-4 border-accent text-left">
              <strong className="text-xs font-bold text-accent block">
                Gợi ý đáp án
              </strong>
              {isSubjectiveType ? (
                <div className="mt-1 font-semibold">
                  <WordDiff original={answer} corrected={naturalAnswer} />
                </div>
              ) : (
                <p className="m-0 mt-1 text-sm md:text-base leading-relaxed font-semibold">
                  {naturalAnswer}
                </p>
              )}
            </div>
          ) : null}
        </>
      )}

      {!isCorrect && literalTranslationTrap ? (
        <div className="mt-3 p-3 px-4 rounded-md bg-danger-light border-l-4 border-danger text-left">
          <strong className="text-xs font-bold text-danger block">
            Bẫy dịch từng từ (Literal Trap)
          </strong>
          <p className="m-0 mt-1.5 text-sm md:text-base leading-relaxed flex flex-wrap items-center gap-1.5">
            <span className="text-muted">Tránh dịch:</span>
            <span className="inline-flex items-center gap-1 bg-danger/10 dark:bg-danger/20 text-danger font-semibold px-2 py-0.5 rounded border border-danger/20 text-sm">
              ✗ &quot;{literalTranslationTrap}&quot;
            </span>
          </p>
        </div>
      ) : null}
    </>
  );
}
