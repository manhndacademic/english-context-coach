"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  AlertCircle,
  HelpCircle,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import { renderRichText } from "@/lib/rich-text";
import type { KeyPhrase } from "@/domain/lesson";
import { translateCategory } from "@/lib/utils";

async function dismissPhrase(patternId: string) {
  const res = await fetch(`/api/review/patterns/${patternId}/dismiss`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error("Failed to dismiss");
}

export function KeyPhraseList({
  phrases,
  /**
   * Optional map from conceptKey → mistakePatternId.
   * When provided, each phrase card shows an "Đã biết" dismiss button.
   */
  phrasePatternMap,
}: {
  phrases: KeyPhrase[];
  phrasePatternMap?: Record<string, string>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  if (!phrases.length) {
    return (
      <p className="text-muted text-sm leading-relaxed m-0">
        Cụm từ then chốt sẽ xuất hiện sau khi phân tích thành công.
      </p>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleDismiss = (phraseId: string, conceptKey: string) => {
    const patternId = phrasePatternMap?.[conceptKey];
    if (!patternId) return;
    startTransition(async () => {
      try {
        await dismissPhrase(patternId);
        setDismissedIds((prev) => new Set([...prev, phraseId]));
      } catch {
        // silently ignore — review card will reappear on next session
      }
    });
  };

  return (
    <div className="grid gap-4">
      {phrases.map((phrase) => {
        const isExpanded = expandedId === phrase.id;
        const isDismissed = dismissedIds.has(phrase.id);
        const hasPatternId = phrasePatternMap?.[phrase.conceptKey];
        const confText = [phrase.literalTranslationVi, phrase.whyConfusingVi]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            className={`border border-border rounded-lg bg-surface overflow-hidden transition-all duration-300 shadow-sm hover:-translate-y-px hover:shadow-md hover:border-accent ${
              isExpanded ? "border-accent shadow-md" : ""
            }`}
            id={`keyphrase-${phrase.id}`}
            key={phrase.id}
          >
            <button
              type="button"
              className="w-full flex items-center justify-between p-4 px-5 text-left bg-transparent border-none cursor-pointer text-text"
              onClick={() => toggleExpand(phrase.id)}
              aria-expanded={isExpanded}
            >
              <div className="grid gap-1.5 flex-1">
                <span className="font-serif text-lg font-extrabold text-accent-strong block">
                  {phrase.phrase}
                  {phrase.ipa && (
                    <span className="font-sans text-xs font-semibold text-muted ml-2 italic select-all font-normal">
                      /{phrase.ipa}/
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-[10px] font-extrabold leading-none">
                    {translateCategory(phrase.category)}
                  </span>
                  <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-[10px] font-extrabold leading-none">
                    {phrase.difficulty}
                  </span>
                  {isDismissed && (
                    <span className="inline-flex items-center gap-1 w-fit rounded-full bg-success text-white dark:text-background border border-transparent px-2.5 py-1 text-[10px] font-extrabold leading-none">
                      <CheckCircle2 size={10} />
                      Đã biết
                    </span>
                  )}
                </span>
                <span className="text-sm text-text leading-relaxed mt-1 block">
                  <strong className="text-accent font-semibold">
                    Nghĩa trong câu:
                  </strong>{" "}
                  {phrase.meaningInContextVi || phrase.meaningVi}
                </span>
              </div>
              <ChevronDown
                size={18}
                className={`text-muted transition-transform duration-300 ml-3 shrink-0 ${
                  isExpanded ? "rotate-180 text-accent" : ""
                }`}
              />
            </button>

            <div
              className={`grid transition-all duration-300 ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden border-t border-border bg-background p-0 px-5 transition-all duration-300">
                <div
                  className={`phrase-row-new-inner transition-all duration-300 ${isExpanded ? "py-5" : "py-0"}`}
                >
                  <div className="grid gap-2 py-3 border-b border-dashed border-border last:border-none last:pb-0 first:pt-0">
                    <div className="flex items-center gap-1.5 text-muted text-xs font-extrabold uppercase tracking-wider">
                      <BookOpen size={14} />
                      <span>Nghĩa cơ bản</span>
                    </div>
                    <div className="text-sm md:text-base leading-relaxed">
                      {renderRichText(phrase.meaningVi)}
                    </div>
                  </div>

                  {phrase.examples && phrase.examples.length > 0 ? (
                    <div className="grid gap-2 py-3 border-b border-dashed border-border last:border-none last:pb-0 first:pt-0">
                      <div className="flex items-center gap-1.5 text-muted text-xs font-extrabold uppercase tracking-wider">
                        <HelpCircle size={14} />
                        <span>Ví dụ thực tế</span>
                      </div>
                      <ol className="list-decimal pl-4 m-0 grid gap-3">
                        {phrase.examples.map((ex) => (
                          <li
                            key={ex.exampleEn}
                            className="text-sm md:text-base leading-relaxed pl-1"
                          >
                            {ex.exampleEn && (
                              <div className="font-serif italic font-semibold text-accent-strong block">
                                {ex.exampleEn}
                                {ex.ipa && (
                                  <span className="font-sans text-xs font-normal text-muted/80 block mt-0.5 select-all">
                                    /{ex.ipa}/
                                  </span>
                                )}
                              </div>
                            )}
                            {ex.exampleVi && (
                              <span className="text-muted text-sm block mt-0.5">
                                {ex.exampleVi}
                              </span>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {phrase.naturalTranslationVi && (
                    <div className="bg-success-light border-l-4 border-success -mx-5 my-2 p-3 px-5 border-b-none grid gap-2">
                      <div className="flex items-center gap-1.5 text-muted text-xs font-extrabold uppercase tracking-wider">
                        <span className="bg-success text-white rounded-full px-2 py-0.5 text-[11px] font-extrabold leading-none">
                          Dịch tự nhiên
                        </span>
                      </div>
                      <div className="text-sm md:text-base leading-relaxed font-semibold text-[#0f5132] dark:text-[#a7f3d0]">
                        {renderRichText(phrase.naturalTranslationVi)}
                      </div>
                    </div>
                  )}

                  {confText.trim().length > 0 && (
                    <div className="bg-danger-light border-l-4 border-danger -mx-5 my-2 p-3 px-5 border-b-none grid gap-2">
                      <div className="flex items-center gap-1.5 text-muted text-xs font-extrabold uppercase tracking-wider">
                        <AlertCircle size={14} className="text-danger" />
                        <span className="text-danger">
                          Bẫy dịch từ &amp; Độ nhầm lẫn
                        </span>
                      </div>
                      <div className="text-sm md:text-base leading-relaxed text-[#7a1515] dark:text-[#ff8585]">
                        {renderRichText(confText)}
                      </div>
                    </div>
                  )}

                  {/* "Đã biết" dismiss button — only shown when we have a pattern ID */}
                  {hasPatternId && !isDismissed && (
                    <div className="pt-3 flex justify-end border-t border-dashed border-border mt-3">
                      <button
                        type="button"
                        id={`dismiss-phrase-${phrase.id}`}
                        onClick={() =>
                          handleDismiss(phrase.id, phrase.conceptKey)
                        }
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-success transition-colors duration-200 border border-border rounded-full px-3 py-1.5 bg-surface hover:bg-success-light hover:border-success disabled:opacity-50"
                        title="Đánh dấu là đã biết — từ này sẽ không xuất hiện trong bài ôn tập"
                      >
                        <CheckCircle2 size={13} />
                        Đã biết — bỏ qua
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
