import type { GenerationJob, GenerationMilestone, Lesson } from "@/db/schema";

export const generationMilestoneCodes = [
  "queued",
  "claimed",
  "analysis_started",
  "text_type_started",
  "confusing_phrases_started",
  "context_analysis_started",
  "saving_analysis",
  "analysis_saved",
  "exercises_started",
  "validating_lesson",
  "exercises_saved",
  "retrying",
  "completed",
  "failed",
] as const;

export type GenerationMilestoneCode = (typeof generationMilestoneCodes)[number];
export type GenerationStage = "analysis" | "exercises" | null;

export type ProgressJobSummary = Pick<GenerationJob, "id" | "status" | "stage" | "attempts" | "createdAt" | "updatedAt">;
export type LessonStatusSnapshot = Pick<Lesson, "analysisStatus" | "exerciseStatus">;
export type ProgressMilestoneSummary = Pick<GenerationMilestone, "id" | "code" | "stage" | "createdAt">;

export const dataAvailabilityMilestones = new Set<GenerationMilestoneCode>([
  "analysis_saved",
  "exercises_saved",
  "completed",
]);

export function isDataAvailabilityMilestone(code: GenerationMilestoneCode) {
  return dataAvailabilityMilestones.has(code);
}

export function isTerminalLessonStatus(status: LessonStatusSnapshot) {
  if (status.analysisStatus === "failed" || status.exerciseStatus === "failed") return true;
  return status.analysisStatus === "succeeded" && status.exerciseStatus === "succeeded";
}

export function selectDisplayGenerationJob<T extends ProgressJobSummary>(jobs: T[]) {
  const active = jobs
    .filter((job) => job.status === "queued" || job.status === "running")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (active[0]) return active[0];
  return [...jobs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}
