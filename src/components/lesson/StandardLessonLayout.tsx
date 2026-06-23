"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { ReadableSourceText } from "@/components/readable-source-text";
import { KeyPhraseList } from "@/components/key-phrase-list";
import { LessonHeader } from "./LessonHeader";
import { SourceMeaningPanel } from "./SourceMeaningPanel";
import { SentenceBreakdownPanel } from "./SentenceBreakdownPanel";
import { ExercisePanel } from "./ExercisePanel";
import { generateExercisesAction } from "@/app/actions/source-texts";
import { Button } from "@/components/ui/button";

interface StandardLessonLayoutProps {
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
    keyPhrases: any[];
    sentenceBreakdowns: any[];
    lessonFocuses: any[];
    exercises: any[];
    exercisePractices: any[];
    mistakePatterns: any[];
    progress: any;
    dueCount?: number;
  };
  now: number;
}

export function StandardLessonLayout({
  user,
  lessonData,
  now,
}: StandardLessonLayoutProps) {
  const {
    lesson,
    sourceText,
    keyPhrases: phrases,
    sentenceBreakdowns,
    lessonFocuses,
    exercises,
    exercisePractices,
    mistakePatterns,
    progress,
    dueCount,
  } = lessonData;

  const [currentPhase, setCurrentPhase] = useState<"understand" | "practice">(
    () => {
      const hasPreviousAttempts = exercisePractices.some(
        (p) => p.attempts && p.attempts.length > 0
      );
      return hasPreviousAttempts ? "practice" : "understand";
    }
  );

  const sourceContent = sourceText?.content;

  // Map from conceptKey → mistakePatternId for phrase-sourced review cards.
  // Used by the "Đã biết" dismiss button on each key phrase card.
  const phrasePatternMap: Record<string, string> = {};
  for (const p of mistakePatterns) {
    if (p.source === "phrase" && p.masteryState === "active") {
      phrasePatternMap[p.conceptKey] = p.id;
    }
  }

  const handleGenerateExercises = async (formData: FormData) => {
    await generateExercisesAction(formData);
  };

  const hasSideColumn =
    phrases.length > 0 ||
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
          <div className="grid gap-item-gap">
            {sourceContent ? (
              <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
                <div className="flex flex-col min-[860px]:flex-row min-[860px]:items-baseline gap-2">
                  <h2 className="text-2xl font-bold text-text m-0">
                    Vần bản gốc (Source)
                  </h2>
                  <span className="text-xs text-muted">
                    Nhấp vào từ/cụm từ tô màu để xem giải nghĩa bên phải.
                  </span>
                </div>
                <div className="border border-border rounded-md p-6 bg-surface font-serif text-[17px] md:text-lg leading-relaxed overflow-y-auto max-h-[340px] min-[860px]:max-h-[500px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.03)] text-text space-y-3 [&_h3]:text-lg [&_h3]:font-bold [&_blockquote]:border-l-3 [&_blockquote]:border-accent [&_blockquote]:pl-3.5 [&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:list-disc [&_ol]:list-decimal [&_pre]:overflow-auto [&_pre]:border [&_pre]:border-border [&_pre]:rounded-md [&_pre]:bg-surface-strong [&_pre]:p-3 [&_pre]:whitespace-pre-wrap">
                  <ReadableSourceText
                    key={`${lesson.id}-${phrases.map((p) => p.id).join(",")}`}
                    doc={sourceContent}
                    phrases={phrases}
                    lessonId={lesson.id}
                  />
                </div>
              </section>
            ) : null}

            <SourceMeaningPanel
              mode="standard"
              lesson={lesson}
              lessonFocuses={lessonFocuses}
            />

            {sentenceBreakdowns.length > 0 && (
              <SentenceBreakdownPanel
                sentenceBreakdowns={sentenceBreakdowns}
                mode="standard"
              />
            )}
          </div>

          {hasSideColumn ? (
            <div className="grid gap-4">
              {phrases.length ? (
                <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
                  <h2 className="text-2xl font-bold text-text m-0">
                    Cụm từ then chốt
                  </h2>
                  <KeyPhraseList
                    phrases={phrases}
                    phrasePatternMap={phrasePatternMap}
                  />
                </section>
              ) : null}

              <div className="relative" id="exercise-panel-section">
                <ExercisePanel
                  lesson={lesson}
                  practices={exercisePractices}
                  dueCount={dueCount}
                />

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
                      Bạn có thể đọc hiểu văn bản gốc trước. Khi sẵn sàng, hãy
                      nhấn nút dưới đây để tạo bài tập thực hành cá nhân hóa.
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
                      <p className="text-xs text-muted max-w-[240px] leading-relaxed mb-5">
                        Đọc hiểu văn bản và cụm từ then chốt ở bên trái. Khi sẵn
                        sàng, hãy nhấn nút dưới đây để bắt đầu luyện tập.
                      </p>
                      <Button
                        type="button"
                        onClick={() => {
                          setCurrentPhase("practice");
                        }}
                        className="animate-pulse-glow w-full font-bold"
                      >
                        Nhấn để bắt đầu luyện tập
                      </Button>
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
