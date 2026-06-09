import { describe, expect, it } from "vitest";
import { nextDueDate, nextReviewAfterSuccess, resetDueAfterFailure } from "./review";

describe("review scheduling", () => {
  it("advances through simple review intervals", () => {
    expect(nextReviewAfterSuccess(0)).toBe(1);
    expect(nextReviewAfterSuccess(1)).toBe(3);
    expect(nextReviewAfterSuccess(3)).toBe(7);
    expect(nextReviewAfterSuccess(7)).toBe(14);
    expect(nextReviewAfterSuccess(14)).toBe(14);
  });

  it("computes due dates from a fixed date", () => {
    const from = new Date("2026-06-09T00:00:00Z");
    expect(nextDueDate(3, from).toISOString()).toBe("2026-06-12T00:00:00.000Z");
    expect(resetDueAfterFailure(from).toISOString()).toBe("2026-06-10T00:00:00.000Z");
  });
});
