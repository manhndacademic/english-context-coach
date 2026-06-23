"use client";

import { useState, useMemo } from "react";
import { AppHeader } from "@/components/app-header";
import { LessonHeader } from "./LessonHeader";
import { ExercisePanel } from "./ExercisePanel";
import {
  generateExercisesAction,
  changeLessonContextAction,
  updateCorrectionPhraseAction,
  toggleCorrectionRejectAction,
} from "@/app/actions/source-texts";
import { diffWords } from "@/domain/lesson/diff-engine";
import { getPlainTextFromJSON } from "@/domain/text/processor";
import { RepeatedMistakeBanner } from "./RepeatedMistakeBanner";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const DOCUMENT_TYPES = [
  { value: "email", label: "Email", icon: "📧" },
  { value: "chat_message", label: "Chat", icon: "💬" },
  { value: "ticket", label: "Ticket", icon: "🎫" },
  { value: "code_review", label: "Code Review", icon: "👀" },
  { value: "technical_doc", label: "Technical Doc", icon: "📄" },
  { value: "meeting_notes", label: "Meeting Notes", icon: "📝" },
  { value: "general", label: "General", icon: "🌐" },
  // legacy
  { value: "work_message", label: "Work Message", icon: "💼" },
  { value: "article", label: "Article", icon: "📰" },
  { value: "academic", label: "Academic", icon: "🎓" },
  { value: "unknown", label: "Unknown", icon: "❓" },
];

const FORMALITY_LEVELS = [
  { value: "formal", label: "Formal" },
  { value: "semi_formal", label: "Semi-formal" },
  { value: "casual", label: "Casual" },
];

function getDocTypeIcon(type: string | null): string {
  const found = DOCUMENT_TYPES.find((d) => d.value === type);
  return found ? found.icon : "🌐";
}

function getDocTypeLabel(type: string | null): string {
  const found = DOCUMENT_TYPES.find((d) => d.value === type);
  return found ? found.label : "General";
}

function getFormalityLabel(form: string | null): string {
  const found = FORMALITY_LEVELS.find((f) => f.value === form);
  return found ? found.label : "Auto";
}

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

  const [rejectedIds, setRejectedIds] = useState<Set<string>>(() => {
    return new Set(
      correctionItems
        .filter((item) => item.isRejected)
        .map((item) => item.id || "")
    );
  });
  const [showDocTypeChips, setShowDocTypeChips] = useState(false);
  const [showFormalityChips, setShowFormalityChips] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "docType" | "formality";
    value: string;
  } | null>(null);
  const [isPendingActionLoading, setIsPendingActionLoading] = useState(false);

  const toggleReject = async (id: string) => {
    const nextRejected = !rejectedIds.has(id);
    setRejectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    try {
      const result = await toggleCorrectionRejectAction({
        lessonId: lesson.id,
        correctionItemId: id,
        isRejected: nextRejected,
      });
      if (result && result.error) {
        setRejectedIds((prev) => {
          const next = new Set(prev);
          if (nextRejected) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
        toast.error("Không thể lưu trạng thái lỗi: " + result.error);
      }
    } catch (err: any) {
      setRejectedIds((prev) => {
        const next = new Set(prev);
        if (nextRejected) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      toast.error("Đã xảy ra lỗi: " + err.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
    setValidationError(null);
  };

  const handleSaveEdit = async (item: any) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setValidationError("Cụm từ sửa không được để trống.");
      return;
    }
    if (trimmed === item.draftPhrase) {
      setValidationError("Cụm từ sửa mới không được trùng với cụm từ nháp cũ.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateCorrectionPhraseAction({
        lessonId: lesson.id,
        correctionItemId: item.id,
        newPhrase: trimmed,
      });

      if (result && result.error) {
        setValidationError(result.error);
      } else {
        setEditingId(null);
        window.location.reload();
      }
    } catch (err: any) {
      setValidationError(err.message || "Đã xảy ra lỗi.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateDocType = (newType: string) => {
    setPendingAction({ type: "docType", value: newType });
  };

  const handleUpdateFormality = (newFormality: string) => {
    setPendingAction({ type: "formality", value: newFormality });
  };

  const executeUpdateDocType = async (newType: string) => {
    setIsPendingActionLoading(true);
    setShowDocTypeChips(false);
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
    setShowFormalityChips(false);
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
      const isRejected = rejectedIds.has(item.id || "");
      const replacement = isRejected ? item.draftPhrase : item.correctedPhrase;
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
  }, [draftContent, correctionItems, rejectedIds]);

  // Calculate deterministic word-level differences
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
            {/* Context override badges */}
            <section className="bg-surface border border-border rounded-lg p-4 shadow-sm flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-muted font-bold uppercase tracking-wider">
                  Bối cảnh giao tiếp:
                </span>

                {/* DocumentType Badge */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDocTypeChips(!showDocTypeChips);
                      setShowFormalityChips(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-full text-sm font-bold text-accent hover:bg-accent/15 cursor-pointer transition-all"
                  >
                    <span>{getDocTypeIcon(lesson.textType)}</span>
                    <span>{getDocTypeLabel(lesson.textType)}</span>
                    <span className="text-xs opacity-65">▼</span>
                  </button>
                </div>

                {/* Formality Badge */}
                {lesson.formality && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowFormalityChips(!showFormalityChips);
                        setShowDocTypeChips(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-full text-sm font-bold text-accent hover:bg-accent/15 cursor-pointer transition-all"
                    >
                      <span>⚖️</span>
                      <span>{getFormalityLabel(lesson.formality)}</span>
                      <span className="text-xs opacity-65">▼</span>
                    </button>
                  </div>
                )}

                {!lesson.formality && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted/10 border border-muted/20 rounded-full text-sm font-bold text-muted select-none">
                    <span>⚖️</span>
                    <span>Auto</span>
                  </div>
                )}
              </div>

              {/* DocumentType chip list */}
              {showDocTypeChips && (
                <div className="border border-border/85 rounded-md p-3 bg-surface-strong/30 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  {DOCUMENT_TYPES.map((type) => {
                    const active = lesson.textType === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => handleUpdateDocType(type.value)}
                        disabled={active}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all border cursor-pointer ${
                          active
                            ? "bg-accent text-white border-accent cursor-default"
                            : "bg-surface text-text border-border hover:bg-surface-strong"
                        }`}
                      >
                        <span>{type.icon}</span>
                        <span>{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Formality chip list */}
              {showFormalityChips && (
                <div className="border border-border/85 rounded-md p-3 bg-surface-strong/30 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  {FORMALITY_LEVELS.map((form) => {
                    const active = lesson.formality === form.value;
                    return (
                      <button
                        key={form.value}
                        type="button"
                        onClick={() => handleUpdateFormality(form.value)}
                        disabled={active}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all border cursor-pointer ${
                          active
                            ? "bg-accent text-white border-accent cursor-default"
                            : "bg-surface text-text border-border hover:bg-surface-strong"
                        }`}
                      >
                        <span>{form.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {lesson.contextExplanationVi && (
              <section className="bg-accent/5 border border-accent/20 rounded-lg p-5 shadow-sm flex items-start gap-3">
                <span className="text-xl">📢</span>
                <div>
                  <h4 className="font-bold text-accent text-sm m-0 mb-1">
                    Đánh giá giọng điệu (Tone Analysis)
                  </h4>
                  <p className="text-sm text-text leading-relaxed m-0 whitespace-pre-wrap">
                    {lesson.contextExplanationVi}
                  </p>
                </div>
              </section>
            )}

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
                        className="bg-red-100 text-red-800 line-through rounded px-0.5 mx-0.5 border-b border-red-300 select-all"
                      >
                        {diff.text}
                      </span>
                    );
                  }
                  if (diff.type === "insert") {
                    return (
                      <span
                        key={key}
                        className="bg-green-100 text-green-800 font-semibold rounded px-0.5 mx-0.5 border-b border-green-300 select-all"
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
                const isRejected = rejectedIds.has(itemKey);
                return (
                  <div
                    key={item.id || index}
                    className={`bg-surface border border-border rounded-lg p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden grid gap-4 ${
                      isRejected
                        ? "opacity-60 bg-surface-strong/30 border-dashed border-border/85"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold tracking-wider uppercase bg-surface-strong border border-border text-text px-2 py-0.5 rounded">
                          {item.category.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] font-bold tracking-wider uppercase bg-danger/10 text-danger px-2 py-0.5 rounded">
                          {item.errorType.replace(/_/g, " ")}
                        </span>
                        {isRejected && (
                          <span className="text-[10px] font-bold tracking-wider uppercase bg-muted/20 text-muted border border-muted/30 px-2 py-0.5 rounded">
                            💡 Tham khảo
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleReject(itemKey)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all border cursor-pointer select-none ${
                          isRejected
                            ? "bg-muted/10 text-muted border-muted/20 hover:bg-muted/20"
                            : "bg-accent/10 text-accent border-accent/20 hover:bg-accent/25"
                        }`}
                      >
                        {isRejected ? "↩️ Giữ bản gốc" : "✅ Đồng ý sửa"}
                      </button>
                    </div>

                    {editingId === item.id ? (
                      <div className="flex flex-col gap-2 bg-surface-strong/50 border border-border/40 rounded-md p-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-red-600 line-through font-serif text-base font-semibold">
                            {item.draftPhrase}
                          </span>
                          <span className="text-muted font-serif">➔</span>
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => {
                              setEditValue(e.target.value);
                              setValidationError(null);
                            }}
                            className="flex-1 bg-surface border border-border rounded px-2.5 py-1 text-base font-bold text-green-600 focus:outline-none focus:border-green-600"
                            disabled={isSaving}
                            autoFocus
                          />
                        </div>
                        {validationError && (
                          <span className="text-xs text-red-500 font-semibold">
                            {validationError}
                          </span>
                        )}
                        <div className="flex gap-2 justify-end mt-1">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-2.5 py-1 bg-muted/10 border border-muted/20 hover:bg-muted/20 text-muted rounded text-xs font-semibold cursor-pointer"
                            disabled={isSaving}
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item)}
                            className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
                            disabled={isSaving}
                          >
                            {isSaving ? "Đang lưu..." : "Lưu"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 bg-surface-strong/50 border border-border/40 rounded-md p-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-red-600 line-through font-serif text-base font-semibold">
                            {item.draftPhrase}
                          </span>
                          <span className="text-muted font-serif">➔</span>
                          <span className="text-green-600 font-serif text-lg font-bold">
                            {item.correctedPhrase}
                          </span>
                        </div>
                        {!isRejected && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(item.id);
                              setEditValue(item.correctedPhrase);
                              setValidationError(null);
                            }}
                            className="p-1 text-muted hover:text-text rounded hover:bg-surface-strong transition-all cursor-pointer text-xs"
                            title="Sửa cụm từ"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    )}

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

                      {item.culturalNoteVi && (
                        <div className="bg-accent/5 border-l-4 border-accent p-3 rounded-r-md text-text">
                          <span className="font-bold text-accent flex items-center gap-1 mb-1 text-xs">
                            🌏 Lưu ý bối cảnh & văn hóa:
                          </span>{" "}
                          {item.culturalNoteVi}
                        </div>
                      )}

                      <div className="border-t border-border/60 pt-3 mt-1">
                        <span className="text-xs text-muted block mb-1">
                          Ví dụ tương tự:
                        </span>
                        <div className="font-serif italic text-text text-base">
                          &ldquo;{item.exampleEn}&rdquo;
                        </div>
                        <div className="text-muted text-sm mt-0.5">
                          ({item.exampleVi})
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          </div>

          {/* Right Column: Exercises Panel */}
          {hasSideColumn ? (
            <div className="grid gap-4">
              <div className="relative" id="exercise-panel-section">
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
                        Xem chi tiết các điểm sửa lỗi ở bên trái. Khi sẵn sàng,
                        hãy nhấn nút dưới đây để bắt đầu luyện tập.
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
