import { describe, expect, it } from "vitest";
import {
  computeSuccessRate,
  microsToUsd,
  normalizeJobStats,
  computeActiveUserCount,
} from "@/lib/admin-metrics";

describe("computeSuccessRate", () => {
  it("returns 100 when total is 0 (avoid division by zero)", () => {
    expect(computeSuccessRate(0, 0)).toBe(100);
  });

  it("returns 100 when all succeed", () => {
    expect(computeSuccessRate(10, 10)).toBe(100);
  });

  it("returns 0 when none succeed", () => {
    expect(computeSuccessRate(10, 0)).toBe(0);
  });

  it("rounds correctly (2/3 → 67)", () => {
    expect(computeSuccessRate(3, 2)).toBe(67);
  });

  it("returns 75 for 3 out of 4", () => {
    expect(computeSuccessRate(4, 3)).toBe(75);
  });
});

describe("microsToUsd", () => {
  it("converts 1_000_000 micros to 1.0", () => {
    expect(microsToUsd(1_000_000)).toBe(1.0);
  });

  it("converts 500_000 micros to 0.5", () => {
    expect(microsToUsd(500_000)).toBe(0.5);
  });

  it("converts 0 to 0", () => {
    expect(microsToUsd(0)).toBe(0);
  });

  it("rounds to 4 decimal places", () => {
    // toFixed(4) truncates beyond 4 decimal places
    // 1 micro = 0.000001 → toFixed(4) → "0.0000" → parseFloat → 0
    expect(microsToUsd(1)).toBe(0);
    // 12345 micros → 0.012345 → toFixed(4) → "0.0123" → parseFloat → 0.0123
    expect(microsToUsd(12345)).toBe(0.0123);
    // 999_999 micros → 0.999999 → toFixed(4) → "1.0000" → parseFloat → 1
    expect(microsToUsd(999_999)).toBe(1);
  });
});

describe("normalizeJobStats", () => {
  it("returns all zeros for an empty array", () => {
    expect(normalizeJobStats([])).toEqual({
      queued: 0,
      running: 0,
      failed: 0,
      succeeded: 0,
    });
  });

  it("maps each status to the correct field", () => {
    const raw = [
      { status: "queued", count: 3 },
      { status: "running", count: 1 },
      { status: "failed", count: 2 },
      { status: "succeeded", count: 42 },
    ];
    expect(normalizeJobStats(raw)).toEqual({
      queued: 3,
      running: 1,
      failed: 2,
      succeeded: 42,
    });
  });

  it("defaults missing statuses to 0", () => {
    const raw = [{ status: "succeeded", count: 7 }];
    expect(normalizeJobStats(raw)).toEqual({
      queued: 0,
      running: 0,
      failed: 0,
      succeeded: 7,
    });
  });

  it("uses the first match when the same status appears multiple times", () => {
    // Array.find returns the first match, so the first entry wins
    const raw = [
      { status: "failed", count: 5 },
      { status: "failed", count: 99 },
    ];
    expect(normalizeJobStats(raw).failed).toBe(5);
  });
});

describe("computeActiveUserCount", () => {
  it("returns 0 for empty result sets", () => {
    expect(computeActiveUserCount([], [])).toBe(0);
  });

  it("deduplicates the same userId across result sets", () => {
    const setA = [{ userId: "user-1" }, { userId: "user-2" }];
    const setB = [{ userId: "user-1" }, { userId: "user-3" }];
    expect(computeActiveUserCount(setA, setB)).toBe(3);
  });

  it("ignores null userIds", () => {
    const rows = [{ userId: null }, { userId: "user-1" }, { userId: null }];
    expect(computeActiveUserCount(rows)).toBe(1);
  });

  it("counts distinct users across all provided result sets", () => {
    const ai = [{ userId: "a" }, { userId: "b" }];
    const attempts = [{ userId: "b" }, { userId: "c" }];
    const reviews = [{ userId: "c" }, { userId: "d" }];
    expect(computeActiveUserCount(ai, attempts, reviews)).toBe(4);
  });

  it("returns 0 when called with no arguments", () => {
    expect(computeActiveUserCount()).toBe(0);
  });

  it("returns 0 when all userIds are null", () => {
    const rows = [{ userId: null }, { userId: null }];
    expect(computeActiveUserCount(rows)).toBe(0);
  });
});
