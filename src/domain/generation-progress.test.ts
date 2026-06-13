import { describe, expect, it } from "vitest";
import {
  isDataAvailabilityMilestone,
  generationThoughtMaxLength,
  sanitizeGenerationThought,
  isTerminalLessonStatus,
  selectDisplayGenerationJob,
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
    expect(isTerminalLessonStatus({ analysisStatus: "failed", exerciseStatus: "pending" })).toBe(false);
    expect(isTerminalLessonStatus({ analysisStatus: "succeeded", exerciseStatus: "succeeded" })).toBe(true);
    expect(isTerminalLessonStatus({ analysisStatus: "failed", exerciseStatus: "failed" })).toBe(true);
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

  it("sanitizes learner-visible generation thoughts before storage", () => {
    const mockProcessor = {
      isSafe: (text: string) => !text.includes("alice@example.com") && !text.includes("secret"),
    };

    expect(sanitizeGenerationThought("  Đang xem xét\nngữ cảnh chính.  ", mockProcessor)).toBe("Đang xem xét ngữ cảnh chính.");
    expect(sanitizeGenerationThought("", mockProcessor)).toBeNull();
    expect(sanitizeGenerationThought("Checking alice@example.com", mockProcessor)).toBeNull();

    const longThought = "a".repeat(generationThoughtMaxLength + 20);
    expect(sanitizeGenerationThought(longThought, mockProcessor)).toHaveLength(generationThoughtMaxLength);
    expect(sanitizeGenerationThought(longThought, mockProcessor)?.endsWith("...")).toBe(true);
  });
});
