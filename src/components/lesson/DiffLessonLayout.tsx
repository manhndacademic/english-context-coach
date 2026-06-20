"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { LessonHeader } from "./LessonHeader";
import { ExercisePanel } from "./ExercisePanel";
import { generateExercisesAction } from "@/app/actions/source-texts";
import { diffWords } from "@/domain/lesson/diff-engine";

interface DiffLessonLayoutProps {
  user: {
    email: string;
    role: string;
    image?: string | null;
  };
  lessonData: {
    lesson: {
      id: string;
      sourceTextId: string;
      version: number;
      analysisStatus: string;
      exerciseStatus: string;
      title: string | null;
      textType: string | null;
      detectedLevel: string | null;
      updatedAt: Date;
      inputMode: string;
      summaryVi: string | null;
      naturalTranslationVi: string | null;
      contextExplanationVi: string | null;
    };
    sourceText: {
      content: string | null;
    } | null;
    draftText?: {
      content: string;
    } | null;
    correctionItems?: any[];
    exercises: any[];
    exercisePractices: any[];
    progress: any;
  };
  now: number;
}

export function DiffLessonLayout({
  user,
  lessonData,
  now,
}: DiffLessonLayoutProps) {
  const {
    lesson,
    sourceText,
    draftText,
    correctionItems = [],
    exercises = [],
    exercisePractices = [],
    progress,
  } = lessonData;

  const [currentPhase, setCurrentPhase] = useState<"understand" | "practice">(
    () => {
      const hasPreviousAttempts = exercisePractices.some(
        (p) => p.attempts && p.attempts.length > 0
      );
      return hasPreviousAttempts ? "practice" : "understand";
    }
  );

  const draftContent = draftText?.content || "";
  const correctedContent = sourceText?.content || "";

  // Calculate deterministic word-level differences
  const diffs = diffWords(draftContent, correctedContent);

  const handleGenerateExercises = async (formData: FormData) => {
    await generateExercisesAction(formData);
  };

  const hasSideColumn =
    correctionItems.length > 0 ||
    exercises.length > 0 ||
    lesson.exerciseStatus !== "succeeded";

  return (
    <>
      <AppHeader
        email={user.email}
        isAdmin={user.role === "admin"}
        image={user.image}
      />
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-10 flex flex-col gap-6">
        <LessonHeader lesson={lesson} progress={progress} now={now} />

        <div
          className={`grid grid-cols-1 ${
            hasSideColumn ? "min-[860px]:grid-cols-[1fr_0.72fr]" : ""
          } gap-layout-gap items-start`}
        >
          {/* Left Column: Diff view and CorrectionItem list */}
          <div className="grid gap-item-gap">
            <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-text m-0">
                  So sánh khác biệt (Word Diff)
                </h2>
                <p className="text-xs text-muted">
                  Đỏ nhạt gạch ngang là bản nháp cũ. Xanh nhạt in đậm là bản đã
                  sửa mới.
                </p>
              </div>

              <div className="border border-border rounded-md p-6 bg-surface font-serif text-[17px] md:text-lg leading-relaxed shadow-[inset_0_2px_8px_rgba(0,0,0,0.03)] text-text space-y-3 whitespace-pre-wrap">
                {diffs.map((diff, index) => {
                  if (diff.type === "delete") {
                    return (
                      <span
                        key={index}
                        className="bg-red-100 text-red-800 line-through rounded px-0.5 mx-0.5 border-b border-red-300 select-all"
                      >
                        {diff.text}
                      </span>
                    );
                  }
                  if (diff.type === "insert") {
                    return (
                      <span
                        key={index}
                        className="bg-green-100 text-green-800 font-semibold rounded px-0.5 mx-0.5 border-b border-green-300 select-all"
                      >
                        {diff.text}
                      </span>
                    );
                  }
                  return <span key={index}>{diff.text}</span>;
                })}
              </div>
            </section>

            {/* List of Corrections */}
            <section className="grid gap-4">
              <h3 className="text-xl font-bold text-text mb-1">
                Chi tiết điểm sửa lỗi ({correctionItems.length})
              </h3>
              {correctionItems.map((item, index) => (
                <div
                  key={item.id || index}
                  className="bg-surface border border-border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden grid gap-4"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold tracking-wider uppercase bg-surface-strong border border-border text-text px-2 py-0.5 rounded">
                      {item.category.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] font-bold tracking-wider uppercase bg-danger/10 text-danger px-2 py-0.5 rounded">
                      {item.errorType.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap bg-surface-strong/50 border border-border/40 rounded-md p-3">
                    <span className="text-red-600 line-through font-serif text-base font-semibold">
                      {item.draftPhrase}
                    </span>
                    <span className="text-muted font-serif">➔</span>
                    <span className="text-green-600 font-serif text-lg font-bold">
                      {item.correctedPhrase}
                    </span>
                  </div>

                  <div className="grid gap-3 text-sm">
                    <div className="text-text leading-relaxed">
                      <strong>Giải thích:</strong> {item.explanationVi}
                    </div>

                    {item.literalTrapVi && (
                      <div className="bg-warning-light border-l-4 border-warning p-3 rounded-r-md text-text">
                        <span className="font-bold text-warning">
                          ⚠️ Bẫy dịch từng từ:
                        </span>{" "}
                        {item.literalTrapVi}
                      </div>
                    )}

                    <div className="border-t border-border/60 pt-3 mt-1">
                      <span className="text-xs text-muted block mb-1">
                        Ví dụ tương tự:
                      </span>
                      <div className="font-serif italic text-text text-base">
                        "{item.exampleEn}"
                      </div>
                      <div className="text-muted text-sm mt-0.5">
                        ({item.exampleVi})
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {hasSideColumn && currentPhase === "understand" && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPhase("practice");
                    setTimeout(() => {
                      const element = document.getElementById(
                        "exercise-panel-section"
                      );
                      if (element) {
                        element.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }
                    }, 50);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold text-white bg-accent hover:bg-accent-hover hover:-translate-y-px active:translate-y-0 transition-all shadow-md cursor-pointer text-base"
                >
                  Đã hiểu các điểm sửa lỗi, bắt đầu thực hành 🚀
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Exercises Panel */}
          {hasSideColumn ? (
            <div className="grid gap-4">
              <div className="relative" id="exercise-panel-section">
                <ExercisePanel lesson={lesson} practices={exercisePractices} />

                {/* Case 1: Exercises not generated yet (Idle) */}
                {lesson.exerciseStatus === "idle" && (
                  <div className="bg-surface border border-border rounded-lg p-6 sm:p-8 text-center flex flex-col items-center justify-center min-h-[280px] shadow-md">
                    <div className="bg-accent-light p-3 rounded-full mb-3 text-accent border border-accent/15">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                        className="w-6 h-6"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-text mb-1.5">
                      Bài tập thực hành chưa được tạo
                    </h3>
                    <p className="text-xs text-muted max-w-[280px] leading-relaxed mb-5">
                      Bạn hãy xem các điểm so sánh lỗi sai ở bên trái trước. Khi
                      sẵn sàng, hãy nhấn nút dưới đây để tạo bài tập thực hành.
                    </p>
                    <form action={handleGenerateExercises} className="w-full">
                      <input type="hidden" name="lessonId" value={lesson.id} />
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white bg-accent hover:bg-accent-hover hover:-translate-y-px active:translate-y-0 transition-all shadow-md cursor-pointer text-sm"
                      >
                        Bắt đầu thực hành 🚀
                      </button>
                    </form>
                  </div>
                )}

                {/* Case 2: Exercises completed, but user is still in 'understand' phase */}
                {lesson.exerciseStatus === "succeeded" &&
                  currentPhase === "understand" && (
                    <div className="absolute inset-0 bg-surface/85 backdrop-blur-[2px] rounded-lg flex flex-col items-center justify-center p-6 text-center select-none z-10 pointer-events-auto border border-dashed border-border/80">
                      <div className="bg-accent-light p-3 rounded-full mb-3 text-accent border border-accent/15">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          stroke="currentColor"
                          className="w-6 h-6"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-text mb-1">
                        Bài tập thực hành đang khóa
                      </h3>
                      <p className="text-xs text-muted max-w-[240px] leading-relaxed mb-4">
                        Xem chi tiết các điểm sửa lỗi ở bên trái để mở khóa bài
                        tập.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentPhase("practice");
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md font-bold text-white bg-accent hover:bg-accent-hover transition-all text-xs cursor-pointer shadow-sm"
                      >
                        Mở khóa ngay
                      </button>
                    </div>
                  )}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
