import { describe, expect, it } from "vitest";
import { isDueMistakePattern, masteryStateAfterReview } from "./mastery";

describe("MistakePattern mastery rules", () => {
  it("keeps due as computed review eligibility instead of persisted mastery state", () => {
    const now = new Date("2026-06-13T00:00:00.000Z");

    expect(
      isDueMistakePattern({
        masteryState: "active",
        reviewPromptStatus: "succeeded",
        dueAt: new Date("2026-06-12T00:00:00.000Z"),
      }, now),
    ).toBe(true);

    expect(
      isDueMistakePattern({
        masteryState: "mastered",
        reviewPromptStatus: "succeeded",
        dueAt: new Date("2026-06-12T00:00:00.000Z"),
      }, now),
    ).toBe(false);
  });

  it("masters a pattern only after a correct review reaches the final interval", () => {
    expect(masteryStateAfterReview(true, 7)).toBe("active");
    expect(masteryStateAfterReview(true, 14)).toBe("mastered");
    expect(masteryStateAfterReview(false, 14)).toBe("active");
  });
});
