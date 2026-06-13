import type { MasteryState, MistakePattern } from "./types";

export const MASTERED_INTERVAL_DAYS = 14;

export function masteryStateAfterReview(isCorrect: boolean, intervalDays: number): MasteryState {
  return isCorrect && intervalDays >= MASTERED_INTERVAL_DAYS ? "mastered" : "active";
}

export function isDueMistakePattern(pattern: Pick<MistakePattern, "dueAt" | "masteryState" | "reviewPromptStatus">, now = new Date()) {
  return (
    pattern.masteryState === "active" &&
    pattern.reviewPromptStatus === "succeeded" &&
    pattern.dueAt.getTime() <= now.getTime()
  );
}
