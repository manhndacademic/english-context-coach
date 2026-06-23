"use client";

import { useState, useMemo } from "react";
import { AppHeader } from "@/components/app-header";
import { LessonHeader } from "./LessonHeader";
import { ExercisePanel } from "./ExercisePanel";
import {
  generateExercisesAction,
  changeLessonContextAction,
} from "@/app/actions/source-texts";
import { diffWords } from "@/domain/lesson/diff-engine";
import { getPlainTextFromJSON } from "@/domain/text/processor";
import { RepeatedMistakeBanner } from "./RepeatedMistakeBanner";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ContextOverrideBadges } from "./ContextOverrideBadges";
import { ToneAnalysisBanner } from "./ToneAnalysisBanner";
import { CorrectionCard } from "./CorrectionCard";
import { LessonPhaseGuard } from "./LessonPhaseGuard";

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
      formality?: string | null;
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
    mistakePatterns?: any[];
    progress: any;
    dueCount?: number;
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
    draftText,
    correctionItems = [],
    exercises = [],
    exercisePractices = [],
    mistakePatterns = [],
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

  const [pendingAction, setPendingAction] = useState<{
    type: "docType" | "formality";
    value: string;
  } | null>(null);
  const [isPendingActionLoading, setIsPendingActionLoading] = useState(false);

  const handleUpdateDocType = (newType: string) => {
    setPendingAction({ type: "docType", value: newType });
  };

  const handleUpdateFormality = (newFormality: string) => {
    setPendingAction({ type: "formality", value: newFormality });
  };

  const executeUpdateDocType = async (newType: string) => {
    setIsPendingActionLoading(true);
    try {
      const result = await changeLessonContextAction({
        lessonId: lesson.id,
        newDocumentType: newType,
      });
      if (result.ok) {
        window.location.reload();
      } else {
        toast.error("Có lỗi xảy ra: " + result.error);
      }
    } catch (err: any) {
      toast.error("Đã xảy ra lỗi: " + err.message);
    } finally {
      setIsPendingActionLoading(false);
      setPendingAction(null);
    }
  };

  const executeUpdateFormality = async (newFormality: string) => {
    setIsPendingActionLoading(true);
    try {
      const result = await changeLessonContextAction({
        lessonId: lesson.id,
        newFormality: newFormality,
      });
      if (result.ok) {
        window.location.reload();
      } else {
        toast.error("Có lỗi xảy ra: " + result.error);
      }
    } catch (err: any) {
      toast.error("Đã xảy ra lỗi: " + err.message);
    } finally {
      setIsPendingActionLoading(false);
      setPendingAction(null);
    }
  };

  const rawDraftContent = draftText?.content || "";
  const draftContent = useMemo(() => {
    if (!rawDraftContent) return "";
    try {
      const parsed = JSON.parse(rawDraftContent);
      if (parsed && typeof parsed === "object" && parsed.type === "doc") {
        return getPlainTextFromJSON(parsed);
      }
    } catch {
      // Ignore JSON parse error, treat as raw text
    }
    return rawDraftContent;
  }, [rawDraftContent]);

  const correctedContent = useMemo(() => {
    let text = draftContent;
    let currentIndex = 0;
    const sorted = [...correctionItems].sort(
      (a, b) => a.orderIndex - b.orderIndex
    );
    for (const item of sorted) {
      const replacement = item.correctedPhrase;
      const index = text.indexOf(item.draftPhrase, currentIndex);
      if (index !== -1) {
        text =
          text.substring(0, index) +
          replacement +
          text.substring(index + item.draftPhrase.length);
        currentIndex = index + replacement.length;
      }
    }
    return text;
  }, [draftContent, correctionItems]);

  const diffs = useMemo(() => {
    return diffWords(draftContent, correctedContent);
  }, [draftContent, correctedContent]);

  const matchedRepeatedMistakes = useMemo(() => {
    return correctionItems
      .map((item) => {
        const pattern = mistakePatterns.find(
          (p) =>
            p.conceptKey.toLowerCase().trim() ===
            item.correctedPhrase.toLowerCase().trim()
        );
        if (pattern) {
          return {
            item,
            pattern,
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{ item: any; pattern: any }>;
  }, [correctionItems, mistakePatterns]);

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

        {currentPhase === "understand" && (
          <RepeatedMistakeBanner repeatedMistakes={matchedRepeatedMistakes} />
        )}

        <div
          className={`grid grid-cols-1 ${
            hasSideColumn ? "min-[860px]:grid-cols-[1fr_0.72fr]" : ""
          } gap-layout-gap items-start`}
        >
          {/* Left Column: Diff view and CorrectionItem list */}
          <div className="grid gap-item-gap">
            <ContextOverrideBadges
              lesson={lesson}
              onUpdateDocType={handleUpdateDocType}
              onUpdateFormality={handleUpdateFormality}
            />

            <ToneAnalysisBanner
              contextExplanationVi={lesson.contextExplanationVi}
            />

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
                  const key = `${diff.type}-${diff.text}-${index}`;
                  if (diff.type === "delete") {
                    return (
                      <span
                        key={key}
                        className="bg-danger-light text-danger-strong line-through rounded px-0.5 mx-0.5 border-b border-danger-strong/20 select-all"
                      >
                        {diff.text}
                      </span>
                    );
                  }
                  if (diff.type === "insert") {
                    return (
                      <span
                        key={key}
                        className="bg-success-light text-success-strong font-semibold rounded px-0.5 mx-0.5 border-b border-success-strong/20 select-all"
                      >
                        {diff.text}
                      </span>
                    );
                  }
                  return <span key={key}>{diff.text}</span>;
                })}
              </div>
            </section>

            {/* List of Corrections */}
            <section className="grid gap-4">
              <h3 className="text-xl font-bold text-text mb-1">
                Chi tiết điểm sửa lỗi ({correctionItems.length})
              </h3>
              {correctionItems.map((item, index) => {
                const itemKey = item.id || index.toString();
                return <CorrectionCard key={itemKey} item={item} />;
              })}
            </section>
          </div>

          {/* Right Column: Exercises Panel */}
          {hasSideColumn ? (
            <div className="grid gap-4">
              <LessonPhaseGuard
                exerciseStatus={lesson.exerciseStatus}
                currentPhase={currentPhase}
                onUnlock={() => setCurrentPhase("practice")}
              >
                <ExercisePanel
                  lesson={lesson}
                  practices={exercisePractices}
                  correctionItems={correctionItems}
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
                      Bạn hãy xem các điểm so sánh lỗi sai ở bên trái trước. Khi
                      sẵn sàng, hãy nhấn nút dưới đây để tạo bài tập thực hành.
                    </p>
                    <form action={handleGenerateExercises} className="w-full">
                      <input type="hidden" name="lessonId" value={lesson.id} />
                      <Button type="submit" className="w-full font-bold">
                        Bắt đầu thực hành 🚀
                      </Button>
                    </form>
                  </div>
                )}
              </LessonPhaseGuard>
            </div>
          ) : null}
        </div>
        <ConfirmDialog
          isOpen={pendingAction !== null}
          onClose={() => setPendingAction(null)}
          onConfirm={async () => {
            if (!pendingAction) return;
            const { type, value } = pendingAction;
            if (type === "docType") {
              await executeUpdateDocType(value);
            } else if (type === "formality") {
              await executeUpdateFormality(value);
            }
          }}
          isPending={isPendingActionLoading}
          title="Thay đổi bối cảnh"
          description="Đổi bối cảnh sẽ phân tích lại toàn bộ và tạo lại bài tập mới. Bạn có chắc chắn muốn tiếp tục?"
          confirmText="Tiếp tục"
          cancelText="Hủy"
        />
      </main>
    </>
  );
}
