import { describe, expect, it, vi, beforeEach } from "vitest";
import { getMasteredCount, getReviewSuccessRate, getMasteredTrend } from "./dashboard-stats";

let mockResolvedValue: any = [];

const mockOrderBy = vi.fn(() => Promise.resolve(mockResolvedValue));
const mockWhere = vi.fn(() => {
  const result: any = {
    orderBy: mockOrderBy,
    then: (onfulfilled: any) => Promise.resolve(mockResolvedValue).then(onfulfilled),
  };
  return result;
});
const mockFrom = vi.fn(() => ({
  where: mockWhere,
}));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock("@/db", () => {
  return {
    db: {
      select: (...args: any[]) => mockSelect(...args),
    },
  };
});

describe("dashboard-stats queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolvedValue = [];
  });

  describe("getMasteredCount", () => {
    it("should return 0 when query returns no rows", async () => {
      mockResolvedValue = [];
      const count = await getMasteredCount("user-1");
      expect(count).toBe(0);
    });

    it("should return correct count value from DB result", async () => {
      mockResolvedValue = [{ value: 12 }];
      const count = await getMasteredCount("user-1");
      expect(count).toBe(12);
    });
  });

  describe("getReviewSuccessRate", () => {
    it("should return 0 when total is 0", async () => {
      mockResolvedValue = [{ total: 0, correct: 0 }];
      const rate = await getReviewSuccessRate("user-1");
      expect(rate).toBe(0);
    });

    it("should round percentage correctly", async () => {
      // 5 correct out of 7 total = 71.428% -> 71
      mockResolvedValue = [{ total: 7, correct: 5 }];
      const rate = await getReviewSuccessRate("user-1");
      expect(rate).toBe(71);
    });

    it("should handle 100% success rate", async () => {
      mockResolvedValue = [{ total: 10, correct: 10 }];
      const rate = await getReviewSuccessRate("user-1");
      expect(rate).toBe(100);
    });
  });

  describe("getMasteredTrend", () => {
    it("should return empty array when no patterns are mastered", async () => {
      mockResolvedValue = [];
      const trend = await getMasteredTrend("user-1");
      expect(trend).toEqual([]);
    });

    it("should calculate cumulative weekly trend correctly", async () => {
      mockResolvedValue = [
        { week: "2026-06-01" },
        { week: "2026-06-01" },
        { week: "2026-06-08" },
        { week: "2026-06-15" },
      ];

      const trend = await getMasteredTrend("user-1");
      expect(trend).toEqual([
        { week: "2026-06-01", cumulative: 2 },
        { week: "2026-06-08", cumulative: 3 },
        { week: "2026-06-15", cumulative: 4 },
      ]);
    });
  });
});
