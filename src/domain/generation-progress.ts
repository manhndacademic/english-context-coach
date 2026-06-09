import type { GenerationJob, GenerationMilestone, GenerationThought, Lesson } from "@/db/schema";
import { containsSourceIdentifyingContent } from "@/domain/privacy";

export const generationMilestoneCodes = [
  "queued",
  "claimed",
  "analysis_started",
  "analysis_saved",
  "exercises_started",
  "exercises_saved",
  "completed",
  "failed",
] as const;

export type GenerationMilestoneCode = (typeof generationMilestoneCodes)[number];
export type GenerationStage = "analysis" | "exercises" | null;

export type ProgressJobSummary = Pick<GenerationJob, "id" | "status" | "stage" | "attempts" | "createdAt" | "updatedAt">;
export type LessonStatusSnapshot = Pick<Lesson, "analysisStatus" | "exerciseStatus">;
export type ProgressMilestoneSummary = Pick<GenerationMilestone, "id" | "code" | "stage" | "createdAt">;
export type ProgressThoughtSummary = Pick<GenerationThought, "id" | "stage" | "text" | "createdAt">;

export const generationThoughtMaxLength = 600;

export const dataAvailabilityMilestones = new Set<GenerationMilestoneCode>([
  "analysis_saved",
  "exercises_saved",
  "completed",
]);

export function isDataAvailabilityMilestone(code: GenerationMilestoneCode) {
  return dataAvailabilityMilestones.has(code);
}

export function isTerminalLessonStatus(status: LessonStatusSnapshot) {
  return (
    (status.analysisStatus === "succeeded" || status.analysisStatus === "failed") &&
    (status.exerciseStatus === "succeeded" || status.exerciseStatus === "failed")
  );
}

export function selectDisplayGenerationJob<T extends ProgressJobSummary>(jobs: T[]) {
  const active = jobs
    .filter((job) => job.status === "queued" || job.status === "running")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (active[0]) return active[0];
  return [...jobs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

export function sanitizeGenerationThought(input: string) {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (containsSourceIdentifyingContent(text)) return null;
  return text.length > generationThoughtMaxLength ? `${text.slice(0, generationThoughtMaxLength - 3).trimEnd()}...` : text;
}
