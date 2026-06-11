import { describe, expect, it } from "vitest";
import {
  isDataAvailabilityMilestone,
  isTerminalLessonStatus,
  selectDisplayGenerationJob,
  generationMilestoneCodes,
  type ProgressJobSummary,
} from "./generation-progress";

function job(input: Partial<ProgressJobSummary> & Pick<ProgressJobSummary, "id" | "status" | "createdAt">): ProgressJobSummary {
  return {
    stage: "analysis",
    attempts: 1,
    updatedAt: input.createdAt,
    ...input,
  };
}

describe("generation progress", () => {
  it("marks only content availability milestones as refresh triggers", () => {
    expect(isDataAvailabilityMilestone("claimed")).toBe(false);
    expect(isDataAvailabilityMilestone("analysis_saved")).toBe(true);
    expect(isDataAvailabilityMilestone("exercises_saved")).toBe(true);
    expect(isDataAvailabilityMilestone("completed")).toBe(true);
  });

  it("treats a lesson as terminal only when both generation stages are terminal", () => {
    expect(isTerminalLessonStatus({ analysisStatus: "succeeded", exerciseStatus: "running" })).toBe(false);
    expect(isTerminalLessonStatus({ analysisStatus: "failed", exerciseStatus: "pending" })).toBe(true);
    expect(isTerminalLessonStatus({ analysisStatus: "succeeded", exerciseStatus: "succeeded" })).toBe(true);
    expect(isTerminalLessonStatus({ analysisStatus: "succeeded", exerciseStatus: "failed" })).toBe(true);
  });

  it("selects the latest active job over completed or failed history", () => {
    const selected = selectDisplayGenerationJob([
      job({ id: "old-failed", status: "failed", createdAt: new Date("2026-06-09T10:00:00Z") }),
      job({ id: "old-success", status: "succeeded", createdAt: new Date("2026-06-09T11:00:00Z") }),
      job({ id: "current", status: "running", createdAt: new Date("2026-06-09T12:00:00Z") }),
    ]);

    expect(selected?.id).toBe("current");
  });

  it("falls back to the latest job when there is no active job", () => {
    const selected = selectDisplayGenerationJob([
      job({ id: "older", status: "failed", createdAt: new Date("2026-06-09T10:00:00Z") }),
      job({ id: "latest", status: "succeeded", createdAt: new Date("2026-06-09T12:00:00Z") }),
    ]);

    expect(selected?.id).toBe("latest");
  });

  it("models safe application-controlled progress milestones without provider thought events", () => {
    expect(generationMilestoneCodes).toContain("analysis_started");
    expect(generationMilestoneCodes).toContain("saving_analysis");
    expect(generationMilestoneCodes).toContain("validating_lesson");
    expect(generationMilestoneCodes).toContain("retrying");
    expect(generationMilestoneCodes).not.toContain("provider_thought" as never);
  });
});
