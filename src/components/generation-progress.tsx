"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type GenerationMilestoneCode,
  isDataAvailabilityMilestone,
  isTerminalLessonStatus,
} from "@/domain/generation-progress";

type StageStatus = "pending" | "running" | "succeeded" | "failed";

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
  status: "queued" | "running" | "succeeded" | "failed";
  stage: string;
  attempts: number;
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

function mergeMilestone(existing: ProgressMilestone[], next: ProgressMilestone) {
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
  const terminal = isTerminalLessonStatus(lesson);
  const active = !terminal;

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
      const payload = JSON.parse((event as MessageEvent).data) as MilestoneStreamPayload;
      setLesson(payload.lesson);
      setJob(payload.job);
      setMilestones((current) => mergeMilestone(current, payload.milestone));

      if (isDataAvailabilityMilestone(payload.milestone.code)) {
        router.refresh();
      }

      if (isTerminalLessonStatus(payload.lesson)) {
        stream.close();
      }
    });
    stream.addEventListener("thought", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as ThoughtStreamPayload;
      setLesson(payload.lesson);
      setJob(payload.job);
      setThoughts((current) => mergeThought(current, payload.thought));

      if (isTerminalLessonStatus(payload.lesson)) {
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
      const response = await fetch(`/api/lessons/${lessonId}/status`, { cache: "no-store" });
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
      return [{ id: 0, code: "queued" as const, stage: null, createdAt: new Date().toISOString() }];
    }
    return [];
  }, [lesson.analysisStatus, milestones]);

  const recentThoughts = useMemo(() => thoughts.slice(-4).reverse(), [thoughts]);
  const latestThought = recentThoughts[0];
  const successfullyCompleted = terminal && lesson.analysisStatus === "succeeded" && lesson.exerciseStatus === "succeeded";

  if (successfullyCompleted && !thoughts.length) {
    return (
      <div className="generation-progress">
        <div className="generation-progress-compact">
          <span className="progress-dot progress-dot-done" />
          <span>Phân tích thành công</span>
          <span className="progress-divider" />
          <span>Bài tập sẵn sàng</span>
        </div>
        <p className="hint">Không có ghi chú tiến trình nào được lưu lại.</p>
      </div>
    );
  }

  return (
    <div className="generation-progress" aria-live="polite">
      <div className="progress-heading">
        <strong>{successfullyCompleted ? "Tạo bài học thành công" : terminal ? "Đã dừng tiến trình" : "Đang tạo bài học tự động"}</strong>
        {job?.attempts && job.attempts > 1 && active ? (
          <span className="muted">Đang thử lại do sự cố tạm thời...</span>
        ) : null}
      </div>
      <ol className="progress-list">
        {visibleMilestones.map((milestone, index) => {
          const isLatest = index === visibleMilestones.length - 1;
          const done = milestone.code === "completed" || milestone.code.endsWith("_saved");
          return (
            <li className="progress-item" key={milestone.id}>
              <span className={`progress-dot ${done ? "progress-dot-done" : ""} ${isLatest ? "progress-dot-current" : ""}`} />
              <span>{milestoneLabels[milestone.code]}</span>
            </li>
          );
        })}
      </ol>
      {latestThought ? (
        <div className="thought-panel">
          <div className="thought-current">
            <span className="thought-label">Chi tiết xử lý</span>
            <p>{latestThought.text}</p>
          </div>
          {recentThoughts.length > 1 ? (
            <ol className="thought-list">
              {recentThoughts.slice(1).map((thought) => (
                <li key={thought.id}>{thought.text}</li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : active ? (
        <div className="thought-panel">
          <div className="thought-current">
            <span className="thought-label">Chi tiết xử lý</span>
            <p className="muted">
              Đang phân tích cấu trúc ngữ cảnh và suy nghĩ phản hồi...
            </p>
          </div>
        </div>
      ) : null}
      {usingFallback && active ? <p className="hint">Không thể xem trực tiếp. Đang tự động làm mới tiến độ mỗi 2.5 giây.</p> : null}
    </div>
  );
}
