import { describe, expect, it, vi, beforeEach } from "vitest";
import { getLearningStreak } from "./streak";

const mockWhere = vi.fn();
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelectDistinct = vi.fn(() => ({ from: mockFrom }));

vi.mock("@/db", () => {
  return {
    db: {
      selectDistinct: (...args: any[]) => mockSelectDistinct(...args),
    },
  };
});

describe("getLearningStreak", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 0 when there are no activities", async () => {
    mockWhere.mockResolvedValueOnce([]); // attempts
    mockWhere.mockResolvedValueOnce([]); // reviews

    const streak = await getLearningStreak("user-1");
    expect(streak).toBe(0);
  });

  it("should return 1 when there is activity only today", async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    mockWhere.mockResolvedValueOnce([{ activityDate: todayStr }]);
    mockWhere.mockResolvedValueOnce([]);

    const streak = await getLearningStreak("user-1");
    expect(streak).toBe(1);
  });

  it("should return 1 when there is activity only yesterday", async () => {
    const yesterdayDate = new Date();
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    mockWhere.mockResolvedValueOnce([]);
    mockWhere.mockResolvedValueOnce([{ activityDate: yesterdayStr }]);

    const streak = await getLearningStreak("user-1");
    expect(streak).toBe(1);
  });

  it("should return 0 when the last activity was 2 days ago (streak broken)", async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);
    const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0, 10);

    mockWhere.mockResolvedValueOnce([{ activityDate: twoDaysAgoStr }]);
    mockWhere.mockResolvedValueOnce([]);

    const streak = await getLearningStreak("user-1");
    expect(streak).toBe(0);
  });

  it("should compute consecutive days correctly (e.g. 5 days)", async () => {
    const dates: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    // attempts has first 3 dates, reviews has last 3 (overlapping)
    mockWhere.mockResolvedValueOnce([
      { activityDate: dates[0] },
      { activityDate: dates[1] },
      { activityDate: dates[2] },
    ]);
    mockWhere.mockResolvedValueOnce([
      { activityDate: dates[2] },
      { activityDate: dates[3] },
      { activityDate: dates[4] },
    ]);

    const streak = await getLearningStreak("user-1");
    expect(streak).toBe(5);
  });
});
