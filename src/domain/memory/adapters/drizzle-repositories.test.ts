import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DrizzleMistakePatternRepository,
  DrizzlePhrasePracticeRepository,
} from "./drizzle-repositories";
import { PhrasePractice } from "../phrase-practice";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function mockChain(result: any) {
  const chain: any = {
    select: () => chain,
    selectDistinct: () => chain,
    from: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled),
  };
  return chain;
}

describe("DrizzleMistakePatternRepository.getDashboardMetrics", () => {
  let repository: DrizzleMistakePatternRepository;
  let mockDbClient: any;
  const testDate = new Date("2026-06-14T12:00:00Z"); // Vietnam: 2026-06-14

  beforeEach(() => {
    mockDbClient = {
      select: vi.fn().mockImplementation(() => mockChain([])),
      selectDistinct: vi.fn().mockImplementation(() => mockChain([])),
    };
    repository = new DrizzleMistakePatternRepository(mockDbClient);
  });

  it("should return correct counts, streak, and trend", async () => {
    // 1. Mock selectDistinct for streak: activity only today
    const todayStr = formatter.format(testDate);
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
      ) // masteredTrend
      .mockReturnValueOnce(mockChain([{ value: 10 }])) // exercisesCompleted
      .mockReturnValueOnce(mockChain([{ value: 4 }])) // lessonsCompleted
      .mockReturnValueOnce(
        mockChain([{ week: "2026-06-08", total: 10, literalCount: 3 }])
      ); // literalErrorTrend

    const result = await repository.getDashboardMetrics("user-1", testDate);

    expect(result.dueCount).toBe(3);
    expect(result.patternCount).toBe(15);
    expect(result.masteredCount).toBe(5);
    expect(result.learningStreakDays).toBe(1);
    expect(result.reviewSuccessRate).toBe(71);
    expect(result.masteredTrend).toEqual([
      { week: "2026-06-01", cumulative: 2 },
      { week: "2026-06-08", cumulative: 3 },
    ]);
    expect(result.exercisesCompleted).toBe(10);
    expect(result.lessonsCompleted).toBe(4);
    expect(result.literalErrorTrend).toEqual([
      { week: "2026-06-08", total: 10, literalRatio: 30 },
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

      const result = await repository.getDashboardMetrics("user-1", testDate);
      expect(result.learningStreakDays).toBe(0);
    });

    it("should return 1 when there is activity only yesterday", async () => {
      const yesterdayDate = new Date(testDate.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = formatter.format(yesterdayDate);

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

      const result = await repository.getDashboardMetrics("user-1", testDate);
      expect(result.learningStreakDays).toBe(1);
    });

    it("should return 0 when the last activity was 2 days ago (streak broken)", async () => {
      const twoDaysAgo = new Date(testDate.getTime() - 2 * 24 * 60 * 60 * 1000);
      const twoDaysAgoStr = formatter.format(twoDaysAgo);

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

      const result = await repository.getDashboardMetrics("user-1", testDate);
      expect(result.learningStreakDays).toBe(0);
    });

    it("should compute consecutive days correctly (e.g. 5 days)", async () => {
      const dates: string[] = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(testDate.getTime() - i * 24 * 60 * 60 * 1000);
        dates.push(formatter.format(d));
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

      const result = await repository.getDashboardMetrics("user-1", testDate);
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

  describe("findAllMistakePatterns", () => {
    it("should query all patterns ordered by updatedAt desc", async () => {
      const dbResult = [
        {
          id: "pattern-1",
          userId: "user-1",
          conceptKey: "concept-1",
          normalizedPhrase: "test phrase 1",
          category: "idiom",
          errorType: "literal_translation",
          meaningVi: "nghĩa 1",
          safeReviewPromptVi: "câu ôn tập 1",
          occurrenceCount: 1,
          intervalDays: 0,
          easeFactor: 2.5,
          repetitions: 0,
          masteryState: "active",
          dueAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDbClient.select.mockReturnValueOnce(mockChain(dbResult));

      const result = await repository.findAllMistakePatterns("user-1");
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("pattern-1");
      expect(mockDbClient.select).toHaveBeenCalled();
    });
  });
});

describe("DrizzlePhrasePracticeRepository", () => {
  it("persists the generated prompt type and choices", async () => {
    let conflictUpdate: Record<string, unknown> | undefined;
    const insertChain: any = {
      values: () => insertChain,
      onConflictDoUpdate: (config: { set: Record<string, unknown> }) => {
        conflictUpdate = config.set;
        return Promise.resolve();
      },
    };
    const repository = new DrizzlePhrasePracticeRepository({
      insert: () => insertChain,
    } as any);
    const practice = PhrasePractice.createNew({
      id: "practice-1",
      userId: "user-1",
      keyPhraseId: "phrase-1",
      conceptKey: "run",
      normalizedPhrase: "run into",
      senseKey: "meet-unexpectedly",
      category: "phrasal_verb",
      meaningVi: "tình cờ gặp",
      isSensitive: false,
    });
    practice.updateReviewPrompt({
      reviewType: "meaning_choice",
      reviewPromptEn: "What does run into mean here?",
      reviewPromptVi: "Cụm từ này có nghĩa gì?",
      reviewRubricVi: "Chọn đúng nghĩa theo ngữ cảnh.",
      reviewCorrectAnswer: "tình cờ gặp",
      reviewAcceptableAnswers: ["vô tình gặp"],
      reviewChoices: ["tình cờ gặp", "điều hành"],
    });

    await repository.savePhrasePractice(practice);

    expect(conflictUpdate).toMatchObject({
      reviewType: "meaning_choice",
      reviewChoices: ["tình cờ gặp", "điều hành"],
    });
  });

  it("preserves scheduling state when a prompt job is claimed", async () => {
    const claimedAt = new Date("2026-06-20T00:00:00Z");
    const repository = new DrizzlePhrasePracticeRepository(
      {} as any,
      (() =>
        Promise.resolve([
          {
            id: "practice-1",
            userId: "user-1",
            keyPhraseId: "phrase-1",
            source: "phrase",
            conceptKey: "run",
            normalizedPhrase: "run into",
            senseKey: "meet-unexpectedly",
            category: "phrasal_verb",
            meaningVi: "tình cờ gặp",
            safeReviewPromptVi: "tình cờ gặp",
            intervalDays: 12,
            easeFactor: 2.15,
            repetitions: 4,
            masteryState: "active",
            dueAt: claimedAt,
            lastReviewedAt: claimedAt,
            isSensitive: false,
            createdAt: claimedAt,
            updatedAt: claimedAt,
            reviewType: "meaning_choice",
            reviewChoices: ["tình cờ gặp", "điều hành"],
            reviewPromptStatus: "running",
            reviewPromptAttempts: 2,
            reviewPromptError: null,
            reviewPromptLockedAt: claimedAt,
            reviewPromptLockedBy: "worker-1",
          },
        ])) as any
    );

    const practice = await repository.claimReviewPromptJob("worker-1");

    expect(practice?.toPlainObject()).toMatchObject({
      keyPhraseId: "phrase-1",
      intervalDays: 12,
      easeFactor: 2.15,
      repetitions: 4,
      reviewType: "meaning_choice",
      reviewChoices: ["tình cờ gặp", "điều hành"],
    });
  });
});
