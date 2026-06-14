import { describe, expect, it, vi, beforeEach } from "vitest";
import { DrizzleLessonRepository } from "./drizzle-lesson-repo";
import { getTextProcessor } from "@/domain/text";

// Infinite-depth Proxy: any property access returns another Proxy of the same kind.
// This lets drizzle expressions like `schema.lessons.id` or `eq(schema.lessons.id, x)`
// receive a stable (non-undefined) value without triggering real DB code.
function makeSchemaProxy(): any {
  const handler: ProxyHandler<object> = {
    get(_target, _prop) {
      return new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

// Mock @/db so imports don't try to open a real DB connection.
vi.mock("@/db", () => ({
  db: {},
  schema: makeSchemaProxy(),
  sql: vi.fn(),
}));

vi.mock("@/lib/jobs/trigger", () => ({
  notifyJobQueued: vi.fn().mockResolvedValue(undefined),
}));

function mockChain(result: any) {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    set: () => chain,
    values: () => chain,
    returning: () => chain,
    onConflictDoNothing: () => chain,
    groupBy: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled),
  };
  return chain;
}

describe("DrizzleLessonRepository — GenerationJob and GenerationProgress methods", () => {
  let repository: DrizzleLessonRepository;
  let mockDbClient: any;

  beforeEach(() => {
    mockDbClient = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(),
    };
    repository = new DrizzleLessonRepository(mockDbClient, getTextProcessor());
  });

  // ---------------------------------------------------------------------------
  // assertQueueCapacity
  // ---------------------------------------------------------------------------
  describe("assertQueueCapacity", () => {
    it("returns null when the user has no active jobs (capacity OK)", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([{ value: 0 }]));

      const result = await repository.assertQueueCapacity("user-1");

      expect(result).toBeNull();
    });

    it("returns an error message in Vietnamese when count >= 1 (over capacity)", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([{ value: 1 }]));

      const result = await repository.assertQueueCapacity("user-1");

      expect(result).toBeTypeOf("string");
      expect(result).toContain("hàng đợi");
    });

    it("returns an error message when count is greater than 1", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([{ value: 3 }]));

      const result = await repository.assertQueueCapacity("user-1");

      expect(result).not.toBeNull();
    });

    it("returns null when query row is empty (defaults to 0)", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([]));

      const result = await repository.assertQueueCapacity("user-1");

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // updateJobStatus
  // ---------------------------------------------------------------------------
  describe("updateJobStatus", () => {
    it("resolves without error when setting status to running", async () => {
      mockDbClient.update.mockReturnValueOnce(mockChain([]));

      await expect(
        repository.updateJobStatus("job-1", "running")
      ).resolves.toBeUndefined();
    });

    it("resolves without error when setting status to succeeded", async () => {
      mockDbClient.update.mockReturnValueOnce(mockChain([]));

      await expect(
        repository.updateJobStatus("job-1", "succeeded")
      ).resolves.toBeUndefined();
    });

    it("resolves without error when setting status to failed with extra fields", async () => {
      mockDbClient.update.mockReturnValueOnce(mockChain([]));

      await expect(
        repository.updateJobStatus("job-1", "failed", {
          errorMessage: "Something went wrong",
        })
      ).resolves.toBeUndefined();
    });

    it("resolves without error when setting status to queued (triggers notifyJobQueued)", async () => {
      // notifyJobQueued is mocked at the @/db module level — just verify no throw
      mockDbClient.update.mockReturnValueOnce(mockChain([]));

      await expect(
        repository.updateJobStatus("job-1", "queued")
      ).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // recordMilestone
  // ---------------------------------------------------------------------------
  describe("recordMilestone", () => {
    it("resolves without error when inserting an analysis stage milestone", async () => {
      mockDbClient.execute.mockResolvedValueOnce([]);

      await expect(
        repository.recordMilestone({
          lessonId: "les-1",
          generationJobId: "job-1",
          code: "queued",
          stage: "analysis",
        })
      ).resolves.toBeUndefined();
    });

    it("resolves without error for exercises stage milestone", async () => {
      mockDbClient.execute.mockResolvedValueOnce([]);

      await expect(
        repository.recordMilestone({
          lessonId: "les-1",
          generationJobId: "job-1",
          code: "completed",
          stage: "exercises",
        })
      ).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // recordThought
  // ---------------------------------------------------------------------------
  describe("recordThought", () => {
    it("inserts a thought when there is no duplicate latest thought", async () => {
      // 1st select: latest thought — empty (no duplicate)
      mockDbClient.select.mockReturnValueOnce(mockChain([]));
      // insert chain
      mockDbClient.insert.mockReturnValueOnce(mockChain([]));

      await expect(
        repository.recordThought({
          lessonId: "les-1",
          generationJobId: "job-1",
          stage: "analysis",
          text: "Đang phân tích nội dung chính của văn bản.",
        })
      ).resolves.toBeUndefined();

      expect(mockDbClient.insert).toHaveBeenCalledTimes(1);
    });

    it("skips inserting when the latest thought is identical (dedup)", async () => {
      const thought = "Đang phân tích nội dung chính của văn bản.";
      // Provide exact text that sanitizeGenerationThought would produce
      mockDbClient.select.mockReturnValueOnce(mockChain([{ text: thought }]));

      await repository.recordThought({
        lessonId: "les-1",
        generationJobId: "job-1",
        stage: "analysis",
        text: thought,
      });

      // insert should NOT be called
      expect(mockDbClient.insert).not.toHaveBeenCalled();
    });

    it("skips all DB calls when text is empty after sanitization", async () => {
      // Empty text → sanitizeGenerationThought returns null → early return
      await repository.recordThought({
        lessonId: "les-1",
        generationJobId: "job-1",
        stage: "analysis",
        text: "",
      });

      expect(mockDbClient.select).not.toHaveBeenCalled();
      expect(mockDbClient.insert).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getLessonProgress
  // ---------------------------------------------------------------------------
  describe("getLessonProgress", () => {
    const lessonRow = {
      id: "les-1",
      analysisStatus: "running",
      exerciseStatus: "pending",
    };

    const jobRow = {
      id: "job-1",
      userId: "user-1",
      sourceTextId: "st-1",
      lessonId: "les-1",
      status: "running",
      stage: "analysis",
      attempts: 1,
      errorMessage: null,
      lockedAt: null,
      lockedBy: null,
      createdAt: new Date("2026-06-14T10:00:00Z"),
      updatedAt: new Date("2026-06-14T10:00:00Z"),
    };

    const milestoneRow = {
      id: 1,
      lessonId: "les-1",
      generationJobId: "job-1",
      code: "claimed",
      stage: "analysis",
      createdAt: new Date(),
    };

    const thoughtRow = {
      id: 1,
      lessonId: "les-1",
      generationJobId: "job-1",
      stage: "analysis",
      text: "Đang xem xét ngữ cảnh.",
      createdAt: new Date(),
    };

    it("returns progress with lesson, job, milestones, and thoughts", async () => {
      // 1st select: lesson status
      mockDbClient.select.mockReturnValueOnce(mockChain([lessonRow]));
      // 2nd select: generation jobs
      mockDbClient.select.mockReturnValueOnce(mockChain([jobRow]));
      // 3rd select: milestones
      mockDbClient.select.mockReturnValueOnce(mockChain([milestoneRow]));
      // 4th select: thoughts
      mockDbClient.select.mockReturnValueOnce(mockChain([thoughtRow]));

      const result = await repository.getLessonProgress({
        lessonId: "les-1",
        userId: "user-1",
      });

      expect(result).not.toBeNull();
      expect(result?.lesson.id).toBe("les-1");
      expect(result?.lesson.analysisStatus).toBe("running");
      expect(result?.lesson.exerciseStatus).toBe("pending");
      expect(result?.job).not.toBeNull();
      expect(result?.job?.id).toBe("job-1");
      expect(result?.milestones).toHaveLength(1);
      expect(result?.thoughts).toHaveLength(1);
    });

    it("returns null when the lesson does not exist for the user", async () => {
      // 1st select: lesson status — not found
      mockDbClient.select.mockReturnValueOnce(mockChain([]));

      const result = await repository.getLessonProgress({
        lessonId: "les-missing",
        userId: "user-1",
      });

      expect(result).toBeNull();
    });

    it("returns empty milestones and thoughts when no job exists", async () => {
      // 1st select: lesson status
      mockDbClient.select.mockReturnValueOnce(mockChain([lessonRow]));
      // 2nd select: generation jobs — empty
      mockDbClient.select.mockReturnValueOnce(mockChain([]));
      // milestones and thoughts queries are skipped when job is null

      const result = await repository.getLessonProgress({
        lessonId: "les-1",
        userId: "user-1",
      });

      expect(result).not.toBeNull();
      expect(result?.job).toBeNull();
      expect(result?.milestones).toEqual([]);
      expect(result?.thoughts).toEqual([]);
    });

    it("returns only new milestones and thoughts when afterMilestoneId / afterThoughtId are set", async () => {
      // 1st select: lesson status
      mockDbClient.select.mockReturnValueOnce(mockChain([lessonRow]));
      // 2nd select: generation jobs
      mockDbClient.select.mockReturnValueOnce(mockChain([jobRow]));
      // 3rd select: milestones after id 1 — empty (already seen)
      mockDbClient.select.mockReturnValueOnce(mockChain([]));
      // 4th select: thoughts after id 1 — one new thought
      mockDbClient.select.mockReturnValueOnce(
        mockChain([
          {
            id: 2,
            lessonId: "les-1",
            generationJobId: "job-1",
            stage: "analysis",
            text: "Mới hơn.",
            createdAt: new Date(),
          },
        ])
      );

      const result = await repository.getLessonProgress({
        lessonId: "les-1",
        userId: "user-1",
        afterMilestoneId: 1,
        afterThoughtId: 1,
      });

      expect(result?.milestones).toHaveLength(0);
      expect(result?.thoughts).toHaveLength(1);
      expect(result?.thoughts[0].id).toBe(2);
    });
  });
});
