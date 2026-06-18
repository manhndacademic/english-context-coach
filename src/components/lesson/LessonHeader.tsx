import {
  regenerateLessonAction,
  retryLessonGenerationAction,
  forceRetryLessonAction,
} from "@/app/actions/source-texts";
import { DeleteLessonButton } from "@/components/delete-lesson-button";
import {
  GenerationProgress,
  type StageStatus,
} from "@/components/generation-progress";

interface LessonHeaderProps {
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
  };
  progress: {
    job: {
      id: string;
      status: "queued" | "running" | "succeeded" | "failed";
      stage: string;
      attempts: number;
      errorMessage: string | null;
    } | null;
    milestones: Array<{
      id: number;
      code: any;
      stage: string | null;
      createdAt: Date;
    }>;
    thoughts: Array<{
      id: number;
      stage: string | null;
      text: string;
      createdAt: Date;
    }>;
  } | null;
  now: number;
}

export function LessonHeader({ lesson, progress, now }: LessonHeaderProps) {
  return (
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
          Thể loại: {lesson.textType?.replaceAll("_", " ") ?? "general"} · Trình
          độ: {lesson.detectedLevel ?? "Đang xác định"}
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
            <form action={retryLessonGenerationAction}>
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
                  errorMessage: progress.job.errorMessage,
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
  );
}
