import React from "react";
import { renderRichText } from "@/lib/rich-text";

interface SourceMeaningPanelProps {
  mode: "standard" | "grammar";
  lesson: {
    summaryVi: string | null;
    naturalTranslationVi: string | null;
    contextExplanationVi: string | null;
  };
  lessonFocuses: Array<{
    id: string;
    title: string;
    explanationVi: string;
    category: string;
    difficulty: string;
  }>;
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function SourceMeaningPanel({
  mode,
  lesson,
  lessonFocuses,
}: SourceMeaningPanelProps) {
  if (!lesson.summaryVi) {
    return (
      <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
        <p className="text-muted text-sm leading-relaxed m-0">
          {mode === "grammar"
            ? "Đang phân tích bài học..."
            : "Bài học đang được phân tích, vui lòng đợi giây lát..."}
        </p>
      </section>
    );
  }

  const isGrammar = mode === "grammar";

  return (
    <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
      <h2 className="text-2xl font-bold text-text m-0">
        {isGrammar ? "Tổng quan chỉnh sửa (Overview)" : "Tóm tắt nội dung"}
      </h2>
      <div className="text-sm md:text-base leading-relaxed text-text m-0">
        {renderRichText(lesson.summaryVi)}
      </div>

      {lesson.naturalTranslationVi && lesson.naturalTranslationVi !== "none" ? (
        <>
          <h2 className="text-2xl font-bold text-text m-0">
            {isGrammar ? "Bản dịch tự nhiên hoàn chỉnh" : "Bản dịch tự nhiên"}
          </h2>
          <div className="font-serif text-base italic leading-relaxed bg-surface-strong p-4 rounded-md text-text m-0">
            {renderRichText(lesson.naturalTranslationVi)}
          </div>
        </>
      ) : null}

      {lesson.contextExplanationVi && lesson.contextExplanationVi !== "none" ? (
        <>
          <h2 className="text-2xl font-bold text-text m-0">
            {isGrammar ? "Giải thích chi tiết" : "Giải thích ngữ cảnh"}
          </h2>
          <div className="text-sm md:text-base leading-relaxed text-text m-0">
            {renderRichText(lesson.contextExplanationVi)}
          </div>
        </>
      ) : null}

      {lessonFocuses.length ? (
        <>
          <h2 className="text-2xl font-bold text-text m-0">Lưu ý quan trọng</h2>
          <div className="grid divide-y divide-border border border-border rounded-md p-4 bg-surface">
            {lessonFocuses.map((focus) => (
              <article
                className="py-3.5 flex flex-col gap-1.5 border-b border-border last:border-none last:pb-0 first:pt-0"
                id={`lessonfocus-${focus.id}`}
                key={focus.id}
              >
                <strong className="text-base font-bold text-text m-0">
                  {focus.title}
                </strong>
                <span className="text-muted text-xs sm:text-sm leading-relaxed m-0">
                  {renderRichText(focus.explanationVi)}
                </span>
                <span className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-[10px] font-extrabold leading-none">
                    {formatLabel(focus.category)}
                  </span>
                  <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-[10px] font-extrabold leading-none">
                    {focus.difficulty}
                  </span>
                </span>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
