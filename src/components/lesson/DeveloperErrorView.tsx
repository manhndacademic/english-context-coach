import React from "react";
import { Terminal } from "lucide-react";
import { renderRichText } from "@/lib/rich-text";

interface DeveloperErrorViewProps {
  sourceContent: string | null;
  lesson: {
    summaryVi: string | null;
    naturalTranslationVi: string | null;
    contextExplanationVi: string | null;
  };
}

export function DeveloperErrorView({
  sourceContent,
  lesson,
}: DeveloperErrorViewProps) {
  return (
    <>
      {sourceContent ? (
        <section className="bg-[#0f172a] text-[#f8fafc] border border-[#1e293b] rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
          <div className="flex flex-col min-[860px]:flex-row min-[860px]:items-baseline border-b border-[#1e293b] pb-3 gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[#38bdf8]">
              <Terminal size={18} />
              <h2 className="text-[#f8fafc] text-lg font-mono m-0">
                Stack Trace / Error Code
              </h2>
            </div>
          </div>
          <pre className="m-0 p-4 bg-[#020617] border border-[#1e293b] rounded-md overflow-auto font-mono text-sm leading-relaxed text-[#f1f5f9]">
            <code>{sourceContent}</code>
          </pre>
        </section>
      ) : null}

      <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
        {lesson.summaryVi ? (
          <div className="grid gap-6">
            <div>
              <h3 className="text-[17px] text-danger border-l-4 border-danger pl-2.5 mb-2 font-bold">
                Ý nghĩa lỗi (Error Meaning)
              </h3>
              <div className="text-[15px] leading-relaxed text-text">
                {renderRichText(lesson.summaryVi)}
              </div>
            </div>

            {lesson.naturalTranslationVi &&
            lesson.naturalTranslationVi !== "none" ? (
              <div>
                <h3 className="text-[17px] text-muted border-l-4 border-muted pl-2.5 mb-2 font-bold">
                  Chi tiết dịch nghĩa (Translation)
                </h3>
                <div className="text-[15px] leading-relaxed text-text">
                  {renderRichText(lesson.naturalTranslationVi)}
                </div>
              </div>
            ) : null}

            <div>
              <h3 className="text-[17px] text-warning border-l-4 border-warning pl-2.5 mb-2 font-bold">
                Nguyên nhân & Cách sửa (Causes & Resolution)
              </h3>
              <div className="text-[15px] leading-relaxed text-text">
                {renderRichText(lesson.contextExplanationVi)}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted text-sm leading-relaxed m-0">
            Đang phân tích lỗi lập trình...
          </p>
        )}
      </section>
    </>
  );
}
