"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type GenerationMilestoneCode,
  isDataAvailabilityMilestone,
  isTerminalLessonStatus,
} from "@/domain/generation-progress";
import { AlertCircle, Copy, Check } from "lucide-react";
import type { GenerationStatus, JobStatus } from "@/domain/types";

export type StageStatus = GenerationStatus;

type LessonStatus = {
  analysisStatus: StageStatus;
  exerciseStatus: StageStatus;
};

type ProgressMilestone = {
  id: number;
  code: GenerationMilestoneCode;
  stage: string | null;
  createdAt: string;
};

type ProgressThought = {
  id: number;
  stage: string | null;
  text: string;
  createdAt: string;
};

type ProgressJob = {
  id: string;
  status: JobStatus;
  stage: string;
  attempts: number;
  errorMessage?: string | null;
} | null;

type ProgressSnapshot = {
  lesson: LessonStatus;
  job: ProgressJob;
  milestones: ProgressMilestone[];
  thoughts: ProgressThought[];
};

type MilestoneStreamPayload = {
  milestone: ProgressMilestone;
  lesson: LessonStatus;
  job: ProgressJob;
};

type ThoughtStreamPayload = {
  thought: ProgressThought;
  lesson: LessonStatus;
  job: ProgressJob;
};

const milestoneLabels: Record<GenerationMilestoneCode, string> = {
  queued: "Đang xếp hàng chờ",
  claimed: "Tiến trình đã bắt đầu",
  analysis_started: "Đang phân tích văn bản gốc",
  analysis_saved: "Phân tích hoàn tất",
  exercises_started: "Đang tạo bài tập thực hành",
  exercises_saved: "Bài tập đã sẵn sàng",
  completed: "Hoàn tất tạo bài học",
  failed: "Xử lý lỗi",
};

function mergeMilestone(
  existing: ProgressMilestone[],
  next: ProgressMilestone
) {
  if (existing.some((milestone) => milestone.id === next.id)) return existing;
  return [...existing, next].sort((a, b) => a.id - b.id);
}

function mergeThought(existing: ProgressThought[], next: ProgressThought) {
  if (existing.some((thought) => thought.id === next.id)) return existing;
  return [...existing, next].sort((a, b) => a.id - b.id);
}

export function GenerationProgress({
  lessonId,
  initialLesson,
  initialJob,
  initialMilestones,
  initialThoughts,
}: {
  lessonId: string;
  initialLesson: LessonStatus;
  initialJob: ProgressJob;
  initialMilestones: ProgressMilestone[];
  initialThoughts: ProgressThought[];
}) {
  const router = useRouter();
  const [lesson, setLesson] = useState(initialLesson);
  const [job, setJob] = useState(initialJob);
  const [milestones, setMilestones] = useState(initialMilestones);
  const [thoughts, setThoughts] = useState(initialThoughts);
  const [usingFallback, setUsingFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const terminal = isTerminalLessonStatus(lesson);
  const active = !terminal;

  const handleCopyDiagnostics = () => {
    if (!job?.errorMessage) return;
    const text = `[ENGLISH CONTEXT COACH - LESSON GENERATION FAILURE]
Lesson ID: ${lessonId}
Job ID: ${job.id}
Stage: ${job.stage}
Attempts: ${job.attempts}
Error Message: ${job.errorMessage}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLesson(initialLesson);
    setJob(initialJob);
    setMilestones(initialMilestones);
    setThoughts(initialThoughts);
  }, [initialJob, initialLesson, initialMilestones, initialThoughts]);

  useEffect(() => {
    if (!active || usingFallback) return;

    const stream = new EventSource(`/api/lessons/${lessonId}/progress/stream`);
    stream.addEventListener("milestone", (event) => {
      const payload = JSON.parse(
        (event as MessageEvent).data
      ) as MilestoneStreamPayload;
      setLesson(payload.lesson);
      setJob(payload.job);
      setMilestones((current) => mergeMilestone(current, payload.milestone));

      if (isDataAvailabilityMilestone(payload.milestone.code)) {
        router.refresh();
      }

      if (isTerminalLessonStatus(payload.lesson)) {
        router.refresh();
        stream.close();
      }
    });
    stream.addEventListener("thought", (event) => {
      const payload = JSON.parse(
        (event as MessageEvent).data
      ) as ThoughtStreamPayload;
      setLesson(payload.lesson);
      setJob(payload.job);
      setThoughts((current) => mergeThought(current, payload.thought));

      if (isTerminalLessonStatus(payload.lesson)) {
        router.refresh();
        stream.close();
      }
    });
    stream.onerror = () => {
      stream.close();
      setUsingFallback(true);
    };

    return () => stream.close();
  }, [active, lessonId, router, usingFallback]);

  useEffect(() => {
    if (!active || !usingFallback) return;

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/lessons/${lessonId}/status`, {
        cache: "no-store",
      });
      if (!response.ok) return;

      const status = (await response.json()) as ProgressSnapshot;
      setLesson(status.lesson);
      setJob(status.job);
      setMilestones(status.milestones);
      setThoughts(status.thoughts);
      router.refresh();

      if (isTerminalLessonStatus(status.lesson)) {
        window.clearInterval(interval);
      }
    }, 2500);

    return () => window.clearInterval(interval);
  }, [active, lessonId, router, usingFallback]);

  const visibleMilestones = useMemo(() => {
    if (milestones.length) return milestones;
    if (lesson.analysisStatus === "pending") {
      return [
        {
          id: 0,
          code: "queued" as const,
          stage: null,
          createdAt: new Date().toISOString(),
        },
      ];
    }
    return [];
  }, [lesson.analysisStatus, milestones]);

  const recentThoughts = useMemo(
    () => thoughts.slice(-4).reverse(),
    [thoughts]
  );
  const latestThought = recentThoughts[0];
  const successfullyCompleted =
    terminal &&
    lesson.analysisStatus === "succeeded" &&
    lesson.exerciseStatus === "succeeded";

  if (successfullyCompleted && !thoughts.length) {
    return (
      <div className="grid gap-4 bg-surface-strong border border-border rounded-md p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-accent">
          <span className="w-2 h-2 rounded-full shrink-0 bg-accent" />
          <span>Phân tích thành công</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span>Bài tập sẵn sàng</span>
        </div>
        <p className="text-xs text-muted leading-relaxed m-0">
          Không có ghi chú tiến trình nào được lưu lại.
        </p>
      </div>
    );
  }

  if (terminal && !successfullyCompleted) {
    return (
      <div className="grid gap-4 bg-danger-light/10 border border-danger/30 rounded-md p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-danger">
          <AlertCircle size={18} />
          <span>Tạo bài học thất bại</span>
        </div>
        <div className="bg-surface border border-border p-3.5 rounded-md text-xs font-mono text-danger whitespace-pre-wrap max-h-40 overflow-y-auto shadow-sm">
          <strong className="block text-muted text-[10px] uppercase font-bold tracking-wider mb-1">
            Thông tin lỗi chi tiết:
          </strong>
          {job?.errorMessage || "Không có thông tin lỗi chi tiết từ máy chủ."}
        </div>
        <div className="flex gap-3 justify-between items-center flex-wrap">
          <span className="text-muted text-[11px]">
            Hãy chụp màn hình hoặc sao chép lỗi này báo lại cho ban quản trị.
          </span>
          {job?.errorMessage ? (
            <button
              onClick={handleCopyDiagnostics}
              className="inline-flex items-center justify-center gap-1.5 min-h-8 rounded-md border border-border px-3 font-bold text-xs bg-surface text-text hover:bg-background transition-all cursor-pointer shadow-sm select-none"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-success" /> Đã sao chép!
                </>
              ) : (
                <>
                  <Copy size={12} /> Sao chép chẩn đoán
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid gap-4 bg-surface-strong border border-border rounded-md p-5"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <strong className="text-base font-bold text-text">
          {successfullyCompleted
            ? "Tạo bài học thành công"
            : terminal
              ? "Đã dừng tiến trình"
              : "Đang tạo bài học tự động"}
        </strong>
        {job?.attempts && job.attempts > 1 && active ? (
          <span className="text-muted text-xs sm:text-sm">
            Đang thử lại do sự cố tạm thời...
          </span>
        ) : null}
      </div>
      <ol className="list-none m-0 p-0 grid gap-2.5">
        {visibleMilestones.map((milestone, index) => {
          const isLatest = index === visibleMilestones.length - 1;
          const done =
            milestone.code === "completed" || milestone.code.endsWith("_saved");
          return (
            <li
              className="flex items-center gap-2.5 text-sm text-text"
              key={milestone.id}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  done ? "bg-accent" : "bg-muted"
                } ${isLatest && active ? "animate-pulse bg-accent" : ""}`}
              />
              <span>{milestoneLabels[milestone.code]}</span>
            </li>
          );
        })}
      </ol>
      {latestThought ? (
        <div className="grid gap-3 bg-surface border border-border rounded-sm p-4">
          <div className="grid gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted">
              Chi tiết xử lý
            </span>
            <p className="text-sm leading-relaxed m-0 text-text">
              {latestThought.text}
            </p>
          </div>
          {recentThoughts.length > 1 ? (
            <ol className="m-0 mt-1 pl-5 list-decimal grid gap-1.5 text-xs sm:text-sm text-muted">
              {recentThoughts.slice(1).map((thought) => (
                <li key={thought.id}>{thought.text}</li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : active ? (
        <div className="grid gap-3 bg-surface border border-border rounded-sm p-4">
          <div className="grid gap-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted">
              Chi tiết xử lý
            </span>
            <p className="text-sm leading-relaxed m-0 text-muted">
              Đang phân tích cấu trúc ngữ cảnh và suy nghĩ phản hồi...
            </p>
          </div>
        </div>
      ) : null}
      {usingFallback && active ? (
        <p className="text-xs text-muted leading-relaxed m-0">
          Không thể xem trực tiếp. Đang tự động làm mới tiến độ mỗi 2.5 giây.
        </p>
      ) : null}
    </div>
  );
}
