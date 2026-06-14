import { notFound } from "next/navigation";
import Link from "next/link";
import React, { type ReactNode } from "react";
import { AlertCircle, Terminal, HelpCircle } from "lucide-react";
import type { KeyPhrase } from "@/domain/lesson";
import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { ExerciseStepper } from "@/components/exercise-stepper";
import {
  GenerationProgress,
  type StageStatus,
} from "@/components/generation-progress";
import { KeyPhraseList } from "@/components/key-phrase-list";
import {
  regenerateLessonAction,
  retryExercisesAction,
  retryLessonGenerationAction,
  forceRetryLessonAction,
} from "@/app/actions/source-texts";
import { DeleteLessonButton } from "@/components/delete-lesson-button";
import { getLessonRepository } from "@/domain/lesson";
import { renderRichText } from "@/lib/rich-text";
import { ReadableSourceText } from "@/components/readable-source-text";
import { completionMistakePatternKey } from "@/components/completion-summary-stats";

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const lessonData = await getLessonRepository().getLessonAggregate(
    id,
    user.id
  );
  if (!lessonData) notFound();

  const {
    lesson,
    sourceText,
    keyPhrases: phrases,
    sentenceBreakdowns,
    lessonFocuses,
    exercises,
    attempts,
    userErrors,
    mistakePatterns,
    progress,
  } = lessonData;

  const attemptsByExercise = new Map<string, typeof attempts>();
  for (const attempt of attempts) {
    const existing = attemptsByExercise.get(attempt.exerciseId) ?? [];
    existing.push(attempt);
    attemptsByExercise.set(attempt.exerciseId, existing);
  }
  const phraseById = new Map(phrases.map((phrase) => [phrase.id, phrase]));
  const focusById = new Map(lessonFocuses.map((focus) => [focus.id, focus]));
  const sourceContent = sourceText?.content;

  const stepperItems = exercises.map((exercise) => {
    const latestAttempt = attemptsByExercise.get(exercise.id)?.[0];
    return {
      exercise,
      attempts: attemptsByExercise.get(exercise.id) ?? [],
      isSolved: Boolean(latestAttempt?.isCorrect),
      needsRetry: Boolean(latestAttempt && !latestAttempt.isCorrect),
      keyPhrase: exercise.keyPhraseId
        ? phraseById.get(exercise.keyPhraseId)
        : undefined,
      lessonFocus: exercise.lessonFocusId
        ? focusById.get(exercise.lessonFocusId)
        : undefined,
    };
  });
  const serializedUserErrors: Record<string, any> = {};
  for (const err of userErrors) {
    if (err.attemptId) {
      serializedUserErrors[err.attemptId] = err;
    }
  }
  const serializedMistakePatterns = Object.fromEntries(
    mistakePatterns.map((pattern) => [
      completionMistakePatternKey(pattern.conceptKey, pattern.errorType),
      {
        conceptKey: pattern.conceptKey,
        errorType: pattern.errorType,
        dueAt: pattern.dueAt.toISOString(),
        masteryState: pattern.masteryState,
      },
    ])
  );

  const isNotEnglishOrUnsupported =
    lesson.inputMode === "not_english" || lesson.inputMode === "unsupported";
  const isDeveloperError = lesson.inputMode === "developer_error_explanation";
  const isGrammarCorrection =
    lesson.inputMode === "fix_and_understand" ||
    lesson.inputMode === "naturalize_english";

  if (isNotEnglishOrUnsupported) {
    return (
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
        <AppHeader email={user.email} isAdmin={user.role === "admin"} />
        <section className="border-l-4 border-warning bg-warning-light p-6 rounded-lg grid gap-5 border border-y-border border-r-border shadow-md">
          <div className="flex flex-wrap items-center gap-2 text-warning font-bold text-lg">
            <AlertCircle size={22} />
            <span>
              Phân tích không khả dụng:{" "}
              {lesson.inputMode === "not_english"
                ? "Văn bản không phải tiếng Anh"
                : "Văn bản không được hỗ trợ"}
            </span>
          </div>
          <p className="mt-3 text-base leading-relaxed text-text">
            {lesson.summaryVi ||
              "Hệ thống chỉ hỗ trợ phân tích các đoạn văn bản tiếng Anh phục vụ cho học tập hoặc công việc."}
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent px-5 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)] h-10"
            >
              Quay lại bảng điều khiển
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const hasSideColumn =
    phrases.length > 0 ||
    exercises.length > 0 ||
    lesson.exerciseStatus === "running";

  return (
    <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
      <AppHeader email={user.email} isAdmin={user.role === "admin"} />

      <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-xs font-extrabold leading-none">
              Phiên bản {lesson.version}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold border leading-none status-${lesson.analysisStatus}`}
            >
              Phân tích:{" "}
              {lesson.analysisStatus === "succeeded"
                ? "Hoàn thành"
                : lesson.analysisStatus === "running"
                  ? "Đang chạy"
                  : lesson.analysisStatus === "failed"
                    ? "Thất bại"
                    : "Đang chờ"}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold border leading-none status-${lesson.exerciseStatus}`}
            >
              Bài tập:{" "}
              {lesson.exerciseStatus === "succeeded"
                ? "Hoàn thành"
                : lesson.exerciseStatus === "running"
                  ? "Đang chạy"
                  : lesson.exerciseStatus === "failed"
                    ? "Thất bại"
                    : "Đang chờ"}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-serif mt-3 mb-2 text-text">
            {lesson.title || "Bài học không tên"}
          </h1>
          <p className="text-muted text-sm m-0">
            Thể loại: {lesson.textType?.replaceAll("_", " ") ?? "general"} ·
            Trình độ: {lesson.detectedLevel ?? "Đang xác định"}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            {lesson.analysisStatus === "succeeded" &&
            lesson.exerciseStatus === "succeeded" ? (
              <form action={regenerateLessonAction}>
                <input
                  name="sourceTextId"
                  type="hidden"
                  value={lesson.sourceTextId}
                />
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 font-semibold text-sm transition-all shadow-sm bg-surface-strong text-text hover:bg-border hover:-translate-y-px h-[38px] cursor-pointer"
                  type="submit"
                >
                  Tạo bản mới (Regenerate)
                </button>
              </form>
            ) : null}

            {(lesson.analysisStatus === "running" ||
              lesson.analysisStatus === "pending" ||
              lesson.exerciseStatus === "running") &&
            now - lesson.updatedAt.getTime() > 45_000 ? (
              <form action={forceRetryLessonAction}>
                <input name="lessonId" type="hidden" value={lesson.id} />
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent px-4 font-semibold text-sm transition-all shadow-sm bg-warning text-white hover:opacity-90 hover:-translate-y-px h-[38px] cursor-pointer"
                  type="submit"
                >
                  Buộc chạy lại
                </button>
              </form>
            ) : null}
            {lesson.analysisStatus === "succeeded" &&
            lesson.exerciseStatus === "failed" ? (
              <form action={retryExercisesAction}>
                <input name="lessonId" type="hidden" value={lesson.id} />
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 font-semibold text-sm transition-all shadow-sm bg-surface-strong text-text hover:bg-border hover:-translate-y-px h-[38px] cursor-pointer"
                  type="submit"
                >
                  Thử lại tạo bài tập
                </button>
              </form>
            ) : null}
            {lesson.analysisStatus === "failed" ? (
              <form action={retryLessonGenerationAction}>
                <input name="lessonId" type="hidden" value={lesson.id} />
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 font-semibold text-sm transition-all shadow-sm bg-surface-strong text-text hover:bg-border hover:-translate-y-px h-[38px] cursor-pointer"
                  type="submit"
                >
                  Thử lại phân tích
                </button>
              </form>
            ) : null}
            <DeleteLessonButton sourceTextId={lesson.sourceTextId} />
          </div>
          <GenerationProgress
            initialJob={
              progress?.job
                ? {
                    id: progress.job.id,
                    status: progress.job.status,
                    stage: progress.job.stage,
                    attempts: progress.job.attempts,
                  }
                : null
            }
            initialLesson={{
              analysisStatus: lesson.analysisStatus as StageStatus,
              exerciseStatus: lesson.exerciseStatus as StageStatus,
            }}
            initialMilestones={
              progress?.milestones.map((milestone) => ({
                id: milestone.id,
                code: milestone.code,
                stage: milestone.stage,
                createdAt: milestone.createdAt.toISOString(),
              })) ?? []
            }
            initialThoughts={
              progress?.thoughts.map((thought) => ({
                id: thought.id,
                stage: thought.stage,
                text: thought.text,
                createdAt: thought.createdAt.toISOString(),
              })) ?? []
            }
            lessonId={lesson.id}
          />
        </div>
      </section>

      <div
        className={`grid grid-cols-1 ${hasSideColumn ? "min-[860px]:grid-cols-[1fr_0.72fr]" : ""} gap-layout-gap items-start`}
      >
        <div className="grid gap-item-gap">
          {isDeveloperError ? (
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
          ) : isGrammarCorrection ? (
            <>
              {sentenceBreakdowns.length ? (
                <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
                  <h2 className="text-2xl font-bold text-text m-0">
                    So sánh sửa lỗi (Grammar & Style Corrections)
                  </h2>
                  <p className="text-xs text-muted leading-relaxed m-0 -mt-2">
                    So sánh trực quan giữa văn bản gốc của bạn và đề xuất chỉnh
                    sửa tự nhiên hơn.
                  </p>

                  <div className="grid gap-5">
                    {sentenceBreakdowns.map((breakdown) => (
                      <div
                        key={breakdown.id}
                        className="border border-border rounded-md overflow-hidden bg-surface"
                      >
                        <div className="grid grid-cols-1 min-[580px]:grid-cols-2 border-b border-border bg-surface-strong">
                          <div className="p-4 border-r border-border bg-danger-light text-danger">
                            <div className="text-[11px] font-bold uppercase mb-2">
                              Bản gốc (Original)
                            </div>
                            <p className="m-0 line-through font-serif text-base leading-relaxed">
                              {breakdown.sentence}
                            </p>
                          </div>

                          <div className="p-4 bg-success-light text-success">
                            <div className="text-[11px] font-bold uppercase mb-2">
                              Bản sửa đổi (Corrected)
                            </div>
                            <p className="m-0 font-serif text-base font-bold leading-relaxed">
                              {breakdown.correctedSentenceEn ||
                                breakdown.sentence}
                            </p>
                          </div>
                        </div>

                        <div className="p-4 grid gap-3">
                          <div>
                            <strong className="text-[11px] font-bold uppercase text-muted tracking-wider block">
                              Dịch nghĩa tự nhiên:
                            </strong>
                            <p className="m-0 mt-1 text-sm md:text-[15px] font-semibold text-text">
                              {renderRichText(breakdown.naturalMeaningVi)}
                            </p>
                          </div>
                          <div>
                            <strong className="text-[11px] font-bold uppercase text-muted tracking-wider block">
                              Giải thích chi tiết:
                            </strong>
                            <p className="m-0 mt-1 text-sm leading-relaxed text-text">
                              {renderRichText(breakdown.structureNotesVi)}
                            </p>
                          </div>
                          {breakdown.toneOrContextVi ? (
                            <div>
                              <strong className="text-[11px] font-bold uppercase text-muted tracking-wider block">
                                Sắc thái / Ngữ cảnh:
                              </strong>
                              <p className="m-0 mt-1 text-sm leading-relaxed text-muted">
                                {renderRichText(breakdown.toneOrContextVi)}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
                {lesson.summaryVi ? (
                  <>
                    <h2 className="text-2xl font-bold text-text m-0">
                      Tổng quan chỉnh sửa (Overview)
                    </h2>
                    <div className="text-sm md:text-base leading-relaxed text-text">
                      {renderRichText(lesson.summaryVi)}
                    </div>

                    {lesson.naturalTranslationVi &&
                    lesson.naturalTranslationVi !== "none" ? (
                      <>
                        <h2 className="text-2xl font-bold text-text m-0">
                          Bản dịch tự nhiên hoàn chỉnh
                        </h2>
                        <p className="font-serif text-base italic leading-relaxed bg-surface-strong p-4 rounded-md text-text m-0">
                          {renderRichText(lesson.naturalTranslationVi)}
                        </p>
                      </>
                    ) : null}

                    {lesson.contextExplanationVi &&
                    lesson.contextExplanationVi !== "none" ? (
                      <>
                        <h2 className="text-2xl font-bold text-text m-0">
                          Giải thích chi tiết
                        </h2>
                        <p className="text-sm md:text-base leading-relaxed text-text m-0">
                          {renderRichText(lesson.contextExplanationVi)}
                        </p>
                      </>
                    ) : null}

                    {lessonFocuses.length ? (
                      <>
                        <h2 className="text-2xl font-bold text-text m-0">
                          Lưu ý quan trọng
                        </h2>
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
                  </>
                ) : (
                  <p className="text-muted text-sm leading-relaxed m-0">
                    Đang phân tích bài học...
                  </p>
                )}
              </section>
            </>
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
                    <ReadableSourceText doc={sourceContent} phrases={phrases} />
                  </div>
                </section>
              ) : null}

              <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
                {lesson.summaryVi ? (
                  <>
                    <h2 className="text-2xl font-bold text-text m-0">
                      Tóm tắt nội dung
                    </h2>
                    <p className="text-sm md:text-base leading-relaxed text-text m-0">
                      {renderRichText(lesson.summaryVi)}
                    </p>
                    <h2 className="text-2xl font-bold text-text m-0">
                      Bản dịch tự nhiên
                    </h2>
                    <p className="font-serif text-base italic leading-relaxed bg-surface-strong p-4 rounded-md text-text m-0">
                      {renderRichText(lesson.naturalTranslationVi)}
                    </p>
                    <h2 className="text-2xl font-bold text-text m-0">
                      Giải thích ngữ cảnh
                    </h2>
                    <p className="text-sm md:text-base leading-relaxed text-text m-0">
                      {renderRichText(lesson.contextExplanationVi)}
                    </p>
                    {lessonFocuses.length ? (
                      <>
                        <h2 className="text-2xl font-bold text-text m-0">
                          Lưu ý quan trọng
                        </h2>
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
                  </>
                ) : (
                  <p className="text-muted text-sm leading-relaxed m-0">
                    Bài học đang được phân tích, vui lòng đợi giây lát...
                  </p>
                )}
              </section>
            </>
          )}
        </div>

        {hasSideColumn ? (
          <div className="grid gap-4">
            {phrases.length ? (
              <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
                <h2 className="text-2xl font-bold text-text m-0">
                  Cụm từ then chốt
                </h2>
                <KeyPhraseList phrases={phrases} />
              </section>
            ) : null}

            {exercises.length || lesson.exerciseStatus === "running" ? (
              <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-text m-0">
                      Luyện tập thực hành
                    </h2>
                    {exercises.length ? (
                      <p className="text-xs text-muted leading-relaxed m-0 mt-1">
                        Tập trung dịch sát nghĩa tự nhiên theo ngữ cảnh, tránh
                        bẫy dịch từng từ.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3">
                  {exercises.length ? (
                    <ExerciseStepper
                      items={stepperItems}
                      serializedMistakePatterns={serializedMistakePatterns}
                      serializedUserErrors={serializedUserErrors}
                    />
                  ) : (
                    <p className="text-muted text-sm leading-relaxed m-0">
                      {lesson.exerciseStatus === "failed"
                        ? "Tạo bài tập thất bại. Hãy chọn thử lại sau khi phân tích hoàn tất."
                        : "Bài tập thực hành đang được tạo tự động..."}
                    </p>
                  )}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
