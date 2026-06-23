import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { getLessonRepository } from "@/domain/lesson";
import {
  getPracticeHistoryRepository,
  getLearnerMemoryEngine,
} from "@/domain/memory";
import { classifyInputMode } from "./lesson-view-model";
import { StandardLessonLayout } from "@/components/lesson/StandardLessonLayout";
import { DiffLessonLayout } from "@/components/lesson/DiffLessonLayout";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [user, { id }] = await Promise.all([requireUser(), params]);
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const [lessonData, practiceState, dueCount] = await Promise.all([
    getLessonRepository().getLessonAggregate(id, user.id),
    getPracticeHistoryRepository().getLessonPracticeState(id, user.id),
    getLearnerMemoryEngine()
      .getDashboardMetrics(user.id, new Date())
      .then((m) => m.dueCount),
  ]);
  if (!lessonData) notFound();

  const attemptsByExercise = new Map<string, any[]>();
  for (const attempt of practiceState.attempts) {
    const arr = attemptsByExercise.get(attempt.exerciseId) ?? [];
    arr.push(attempt);
    attemptsByExercise.set(attempt.exerciseId, arr);
  }

  const userErrorByAttempt = new Map<string, any>();
  for (const error of practiceState.userErrors) {
    if (error.attemptId) {
      userErrorByAttempt.set(error.attemptId, error);
    }
  }

  const plainMistakePatterns = practiceState.mistakePatterns.map((p) =>
    p.toPlainObject()
  );

  const patternsByKey = new Map<string, any>();
  for (const pattern of plainMistakePatterns) {
    patternsByKey.set(`${pattern.conceptKey}:${pattern.errorType}`, pattern);
  }

  const phrasesById = new Map(lessonData.keyPhrases.map((p) => [p.id, p]));
  const focusesById = new Map(lessonData.lessonFocuses.map((f) => [f.id, f]));

  const exercisePractices = lessonData.exercises.map((exercise) => {
    const attempts = attemptsByExercise.get(exercise.id) ?? [];
    const latestAttempt = attempts[0];
    const userError = latestAttempt
      ? userErrorByAttempt.get(latestAttempt.id)
      : undefined;

    let mistakePattern;
    if (userError) {
      mistakePattern = patternsByKey.get(
        `${userError.conceptKey}:${userError.errorType}`
      );
    }

    return {
      exercise,
      attempts,
      keyPhrase: exercise.keyPhraseId
        ? phrasesById.get(exercise.keyPhraseId)
        : undefined,
      lessonFocus: exercise.lessonFocusId
        ? focusesById.get(exercise.lessonFocusId)
        : undefined,
      userError,
      mistakePattern,
    };
  });

  const combinedLessonData = {
    ...lessonData,
    exercisePractices,
    mistakePatterns: plainMistakePatterns,
    dueCount,
  };

  const { lesson } = lessonData;
  const { isNotEnglishOrUnsupported } = classifyInputMode(lesson.inputMode);

  if (isNotEnglishOrUnsupported) {
    return (
      <>
        <AppHeader
          email={user.email}
          isAdmin={user.role === "admin"}
          image={user.image}
        />
        <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-10 flex flex-col gap-6">
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
      </>
    );
  }

  if (
    (lesson.inputMode === "diff" || lesson.inputMode === "write") &&
    lessonData.draftText
  ) {
    return (
      <DiffLessonLayout
        user={{ email: user.email, role: user.role, image: user.image }}
        lessonData={combinedLessonData}
        now={now}
      />
    );
  }

  return (
    <StandardLessonLayout
      user={{ email: user.email, role: user.role, image: user.image }}
      lessonData={combinedLessonData}
      now={now}
    />
  );
}
