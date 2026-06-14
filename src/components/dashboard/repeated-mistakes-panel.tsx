import React from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { retryReviewPromptGenerationAction } from "@/app/actions/review";

interface RepeatedMistakesPanelProps {
  repeatedMistakes: Array<{
    id: string;
    normalizedPhrase: string;
    occurrenceCount: number;
    meaningVi: string;
    errorType: string;
    reviewPromptStatus: string;
  }>;
}

export function RepeatedMistakesPanel({
  repeatedMistakes,
}: RepeatedMistakesPanelProps) {
  return (
    <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-3.5">
      <h2 className="text-xl font-bold text-text flex items-center gap-2 m-0">
        <AlertCircle size={18} className="text-muted" /> Mẫu lỗi lặp lại nổi bật
      </h2>
      <div className="grid divide-y divide-border">
        {repeatedMistakes.length ? (
          repeatedMistakes.map((pattern) => (
            <div
              className="py-3 flex flex-col gap-1.5 first:pt-0 last:pb-0"
              key={pattern.id}
            >
              <div className="flex justify-between items-center gap-2">
                <strong className="text-accent-strong text-[15px] font-bold">
                  {pattern.normalizedPhrase}
                </strong>
                <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2 py-0.5 text-muted text-[10px] font-extrabold leading-none">
                  Gặp {pattern.occurrenceCount} lần
                </span>
              </div>
              <span className="text-muted text-sm leading-relaxed">
                Nghĩa đúng: {pattern.meaningVi}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-extrabold bg-danger-light border border-danger text-danger uppercase tracking-wider leading-none">
                  {pattern.errorType.replaceAll("_", " ")}
                </span>
                {pattern.reviewPromptStatus === "succeeded" ? (
                  <Link
                    href="/review"
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-accent no-underline hover:underline"
                  >
                    Ôn tập <ArrowRight size={10} />
                  </Link>
                ) : pattern.reviewPromptStatus === "failed" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-danger text-[10px] font-bold bg-danger-light border border-danger/10 px-2 py-0.5 rounded leading-none shrink-0">
                      Lỗi tạo câu hỏi
                    </span>
                    <form
                      action={retryReviewPromptGenerationAction}
                      className="inline-flex items-center"
                    >
                      <input
                        type="hidden"
                        name="patternId"
                        value={pattern.id}
                      />
                      <button
                        type="submit"
                        className="text-[10px] font-extrabold text-accent bg-transparent border-none p-0 cursor-pointer hover:underline leading-none"
                      >
                        Tạo lại
                      </button>
                    </form>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted bg-surface-strong border border-border px-2 py-0.5 rounded leading-none shrink-0">
                    <span className="w-1.5 h-1.5 bg-warning rounded-full animate-pulse shrink-0" />
                    Đang chuẩn bị...
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted text-sm leading-relaxed m-0 pt-2">
            Các mẫu lỗi sai lặp lại sẽ xuất hiện ở đây sau khi bạn làm bài tập
            và tích lũy bộ nhớ lỗi.
          </p>
        )}
      </div>
    </section>
  );
}
