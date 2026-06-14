import { describe, expect, it, vi, beforeEach } from "vitest";
import { DrizzleMistakePatternRepository } from "./drizzle-repositories";

function mockChain(result: any) {
  const chain: any = {
    select: () => chain,
    selectDistinct: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled),
  };
  return chain;
}

describe("DrizzleMistakePatternRepository.getDashboardMetrics", () => {
  let repository: DrizzleMistakePatternRepository;
  let mockDbClient: any;

  beforeEach(() => {
    mockDbClient = {
      select: vi.fn(),
      selectDistinct: vi.fn(),
    };
    repository = new DrizzleMistakePatternRepository(mockDbClient);
  });

  it("should return correct counts, streak, and trend", async () => {
    // 1. Mock selectDistinct for streak: activity only today
    const todayStr = new Date().toISOString().slice(0, 10);
    mockDbClient.selectDistinct
      .mockReturnValueOnce(mockChain([{ activityDate: todayStr }])) // attempts
      .mockReturnValueOnce(mockChain([])); // reviewAttempts

    // 2. Mock Promise.all select queries
    mockDbClient.select
      .mockReturnValueOnce(mockChain([{ value: 3 }])) // dueCount
      .mockReturnValueOnce(mockChain([{ value: 15 }])) // patternCount
      .mockReturnValueOnce(mockChain([{ value: 5 }])) // masteredCount
      .mockReturnValueOnce(mockChain([])) // repeatedMistakes
      .mockReturnValueOnce(mockChain([{ total: 7, correct: 5 }])) // reviewSuccessRate: 5/7 = 71%
      .mockReturnValueOnce(
        mockChain([
          { week: "2026-06-01" },
          { week: "2026-06-01" },
          { week: "2026-06-08" },
        ])
      ); // masteredTrend

    const result = await repository.getDashboardMetrics("user-1", new Date());

    expect(result.dueCount).toBe(3);
    expect(result.patternCount).toBe(15);
    expect(result.masteredCount).toBe(5);
    expect(result.learningStreakDays).toBe(1);
    expect(result.reviewSuccessRate).toBe(71);
    expect(result.masteredTrend).toEqual([
      { week: "2026-06-01", cumulative: 2 },
      { week: "2026-06-08", cumulative: 3 },
    ]);
  });

  describe("learningStreakDays calculations", () => {
    it("should return 0 when there are no activities", async () => {
      mockDbClient.selectDistinct
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]));

      mockDbClient.select
        .mockReturnValueOnce(mockChain([])) // dueCount
        .mockReturnValueOnce(mockChain([])) // patternCount
        .mockReturnValueOnce(mockChain([])) // masteredCount
        .mockReturnValueOnce(mockChain([])) // repeatedMistakes
        .mockReturnValueOnce(mockChain([])) // reviewSuccessRate
        .mockReturnValueOnce(mockChain([])); // masteredTrend

      const result = await repository.getDashboardMetrics("user-1", new Date());
      expect(result.learningStreakDays).toBe(0);
    });

    it("should return 1 when there is activity only yesterday", async () => {
      const yesterdayDate = new Date();
      yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
      const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

      mockDbClient.selectDistinct
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([{ activityDate: yesterdayStr }]));

      mockDbClient.select
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]));

      const result = await repository.getDashboardMetrics("user-1", new Date());
      expect(result.learningStreakDays).toBe(1);
    });

    it("should return 0 when the last activity was 2 days ago (streak broken)", async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0, 10);

      mockDbClient.selectDistinct
        .mockReturnValueOnce(mockChain([{ activityDate: twoDaysAgoStr }]))
        .mockReturnValueOnce(mockChain([]));

      mockDbClient.select
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]));

      const result = await repository.getDashboardMetrics("user-1", new Date());
      expect(result.learningStreakDays).toBe(0);
    });

    it("should compute consecutive days correctly (e.g. 5 days)", async () => {
      const dates: string[] = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        dates.push(d.toISOString().slice(0, 10));
      }

      mockDbClient.selectDistinct
        .mockReturnValueOnce(
          mockChain([
            { activityDate: dates[0] },
            { activityDate: dates[1] },
            { activityDate: dates[2] },
          ])
        ) // attempts
        .mockReturnValueOnce(
          mockChain([
            { activityDate: dates[2] },
            { activityDate: dates[3] },
            { activityDate: dates[4] },
          ])
        ); // reviewAttempts

      mockDbClient.select
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]));

      const result = await repository.getDashboardMetrics("user-1", new Date());
      expect(result.learningStreakDays).toBe(5);
    });
  });

  describe("reviewSuccessRate calculations", () => {
    it("should return 0 when total review attempts is 0", async () => {
      mockDbClient.selectDistinct
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]));

      mockDbClient.select
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([{ total: 0, correct: 0 }])) // reviewSuccessRate
        .mockReturnValueOnce(mockChain([]));

      const result = await repository.getDashboardMetrics("user-1", new Date());
      expect(result.reviewSuccessRate).toBe(0);
    });
  });
});
