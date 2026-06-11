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
  queued: "Queued",
  claimed: "Worker started",
  analysis_started: "Analyzing source text",
  analysis_saved: "Analysis ready",
  exercises_started: "Generating Exercises",
  exercises_saved: "Exercises ready",
  completed: "Generation complete",
  failed: "Generation failed",
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
          <span>Analysis complete</span>
          <span className="progress-divider" />
          <span>Exercises ready</span>
        </div>
        <p className="hint">Model thinking was not captured for this generation.</p>
      </div>
    );
  }

  return (
    <div className="generation-progress" aria-live="polite">
      <div className="progress-heading">
        <strong>{successfullyCompleted ? "Generation complete" : terminal ? "Generation stopped" : "Generating lesson"}</strong>
        {job?.attempts && job.attempts > 1 && active ? (
          <span className="muted">Retrying after a temporary issue</span>
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
            <span className="thought-label">Thinking now</span>
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
            <span className="thought-label">Thinking now</span>
            <p className="muted">
              Waiting for the model to publish a thought summary. Some configured models do not provide one.
            </p>
          </div>
        </div>
      ) : null}
      {usingFallback && active ? <p className="hint">Live stream unavailable. Checking progress periodically.</p> : null}
    </div>
  );
}
