"use client";

import { useState } from "react";
import { ChevronDown, AlertCircle, HelpCircle, BookOpen } from "lucide-react";
import { renderRichText } from "@/lib/rich-text";
import type { KeyPhrase } from "@/domain/lesson";

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function KeyPhraseList({ phrases }: { phrases: KeyPhrase[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!phrases.length) {
    return <p className="text-muted text-sm leading-relaxed m-0">Cụm từ then chốt sẽ xuất hiện sau khi phân tích thành công.</p>;
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="grid gap-4">
      {phrases.map((phrase) => {
        const isExpanded = expandedId === phrase.id;
        const confText = [phrase.literalTranslationVi, phrase.whyConfusingVi].filter(Boolean).join(" ");

        return (
          <div
            className={`border border-border rounded-lg bg-surface overflow-hidden transition-all duration-300 shadow-sm hover:-translate-y-px hover:shadow-md hover:border-accent ${
              isExpanded ? "border-accent shadow-md" : ""
            }`}
            id={`keyphrase-${phrase.id}`}
            key={phrase.id}
          >
            <button
              className="w-full flex items-center justify-between p-4 px-5 text-left bg-transparent border-none cursor-pointer text-text"
              onClick={() => toggleExpand(phrase.id)}
              aria-expanded={isExpanded}
            >
              <div className="grid gap-1.5 flex-1">
                <span className="font-serif text-lg font-extrabold text-accent-strong block">{phrase.phrase}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-[10px] font-extrabold leading-none">
                    {formatLabel(phrase.category)}
                  </span>
                  <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-[10px] font-extrabold leading-none">
                    {phrase.difficulty}
                  </span>
                </span>
                <span className="text-sm text-text leading-relaxed mt-1 block">
                  <strong className="text-accent font-semibold">Nghĩa trong câu:</strong> {phrase.meaningInContextVi || phrase.meaningVi}
                </span>
              </div>
              <ChevronDown
                size={18}
                className={`text-muted transition-transform duration-300 ml-3 shrink-0 ${
                  isExpanded ? "rotate-180 text-accent" : ""
                }`}
              />
            </button>

            <div className={`grid transition-all duration-300 ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden border-t border-border bg-background p-0 px-5 transition-all duration-300">
                <div className={`phrase-row-new-inner transition-all duration-300 ${isExpanded ? "py-5" : "py-0"}`}>
                  <div className="grid gap-2 py-3 border-b border-dashed border-border last:border-none last:pb-0 first:pt-0">
                    <div className="flex items-center gap-1.5 text-muted text-xs font-extrabold uppercase tracking-wider">
                      <BookOpen size={14} />
                      <span>Nghĩa cơ bản</span>
                    </div>
                    <div className="text-sm md:text-base leading-relaxed">
                      {renderRichText(phrase.meaningVi)}
                    </div>
                  </div>

                  {phrase.exampleEn || phrase.exampleVi ? (
                    <div className="grid gap-2 py-3 border-b border-dashed border-border last:border-none last:pb-0 first:pt-0">
                      <div className="flex items-center gap-1.5 text-muted text-xs font-extrabold uppercase tracking-wider">
                        <HelpCircle size={14} />
                        <span>Ví dụ thực tế</span>
                      </div>
                      <div className="text-sm md:text-base leading-relaxed">
                        {phrase.exampleEn && <span className="font-serif italic font-semibold text-accent-strong text-sm md:text-base block">{phrase.exampleEn}</span>}
                        {phrase.exampleVi && <span className="text-muted text-sm block mt-0.5">{phrase.exampleVi}</span>}
                      </div>
                    </div>
                  ) : null}

                  {phrase.naturalTranslationVi && (
                    <div className="bg-success-light border-l-4 border-success -mx-5 my-2 p-3 px-5 border-b-none grid gap-2">
                      <div className="flex items-center gap-1.5 text-muted text-xs font-extrabold uppercase tracking-wider">
                        <span className="bg-success text-white rounded-full px-2 py-0.5 text-[11px] font-extrabold leading-none">Dịch tự nhiên</span>
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
                        <span className="text-danger">Bẫy dịch từ & Độ nhầm lẫn</span>
                      </div>
                      <div className="text-sm md:text-base leading-relaxed text-[#7a1515] dark:text-[#ff8585]">
                        {renderRichText(confText)}
                      </div>
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
