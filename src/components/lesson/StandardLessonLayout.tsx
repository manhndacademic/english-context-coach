"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { ReadableSourceText } from "@/components/readable-source-text";
import { KeyPhraseList } from "@/components/key-phrase-list";
import { LessonHeader } from "./LessonHeader";
import { DeveloperErrorView } from "./DeveloperErrorView";
import { GrammarCorrectionView } from "./GrammarCorrectionView";
import { SourceMeaningPanel } from "./SourceMeaningPanel";
import { SentenceBreakdownPanel } from "./SentenceBreakdownPanel";
import { ExercisePanel } from "./ExercisePanel";
import { MixedLanguageView } from "./MixedLanguageView";
import { classifyInputMode } from "@/app/lessons/[id]/lesson-view-model";

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

  const { isDeveloperError, isGrammarCorrection, isMixedLanguage } =
    classifyInputMode(lesson.inputMode);

  const hasSideColumn =
    phrases.length > 0 ||
    exercises.length > 0 ||
    lesson.exerciseStatus === "running";

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
            {isDeveloperError ? (
              <DeveloperErrorView
                sourceContent={sourceContent ?? null}
                lesson={lesson}
              />
            ) : isGrammarCorrection ? (
              <GrammarCorrectionView
                lesson={lesson}
                sourceContent={sourceContent ?? null}
                phrases={phrases}
                sentenceBreakdowns={sentenceBreakdowns}
                lessonFocuses={lessonFocuses}
              />
            ) : isMixedLanguage ? (
              <MixedLanguageView
                lesson={lesson}
                sourceContent={sourceContent ?? null}
                phrases={phrases}
                sentenceBreakdowns={sentenceBreakdowns}
                lessonFocuses={lessonFocuses}
              />
            ) : (
              <>
                {sourceContent ? (
                  <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
                    <div className="flex flex-col min-[860px]:flex-row min-[860px]:items-baseline gap-2">
                      <h2 className="text-2xl font-bold text-text m-0">
                        Văn bản gốc (Source)
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
              </>
            )}

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
                  Đã hiểu ngữ cảnh, bắt đầu thực hành 🚀
                </button>
              </div>
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
                <ExercisePanel lesson={lesson} practices={exercisePractices} />
                {currentPhase === "understand" && (
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
                    <p className="text-xs text-muted max-w-[240px] leading-relaxed">
                      Đọc hiểu văn bản và cụm từ then chốt bên trái để mở khóa
                      bài tập.
                    </p>
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
