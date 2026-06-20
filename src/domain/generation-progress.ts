import type {
  GenerationJob,
  GenerationMilestone,
  GenerationThought,
  Lesson,
} from "./lesson/ports";
import type { TextProcessor } from "@/domain/text";

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

export type ProgressJobSummary = Pick<
  GenerationJob,
  "id" | "status" | "stage" | "attempts" | "createdAt" | "updatedAt"
>;
export type LessonStatusSnapshot = Pick<
  Lesson,
  "analysisStatus" | "exerciseStatus"
>;
export type ProgressMilestoneSummary = Pick<
  GenerationMilestone,
  "id" | "code" | "stage" | "createdAt"
>;
export type ProgressThoughtSummary = Pick<
  GenerationThought,
  "id" | "stage" | "text" | "createdAt"
>;

export const generationThoughtMaxLength = 600;

const internalGenerationThoughtPatterns = [
  /\b(json|schema|prompt|system instruction|chain[- ]?of[- ]?thought|hidden reasoning)\b/i,
  /\b(code|function|typescript|javascript|tsx|sql|zod|drizzle)\b/i,
  /```/,
  /[{}`;]/,
];

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
    (status.analysisStatus === "succeeded" ||
      status.analysisStatus === "failed") &&
    (status.exerciseStatus === "idle" ||
      status.exerciseStatus === "succeeded" ||
      status.exerciseStatus === "failed")
  );
}

export function selectDisplayGenerationJob<T extends ProgressJobSummary>(
  jobs: T[]
) {
  const active = jobs
    .filter((job) => job.status === "queued" || job.status === "running")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (active[0]) return active[0];
  return [...jobs].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )[0];
}

export function sanitizeGenerationThought(
  input: string,
  textProcessor: Pick<TextProcessor, "isSafe">
) {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (!textProcessor.isSafe(text)) return null;
  if (internalGenerationThoughtPatterns.some((pattern) => pattern.test(text)))
    return null;
  return text.length > generationThoughtMaxLength
    ? `${text.slice(0, generationThoughtMaxLength - 3).trimEnd()}...`
    : text;
}
