import { describe, expect, it, vi, beforeEach } from "vitest";
import { DrizzleLessonRepository } from "./drizzle-lesson-repo";
import { getTextProcessor } from "@/domain/text";

function makeSchemaProxy(): any {
  const handler: ProxyHandler<object> = {
    get(_target, _prop) {
      return new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

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

describe("DrizzleLessonRepository", () => {
  let repository: DrizzleLessonRepository;
  let mockDbClient: any;

  beforeEach(() => {
    mockDbClient = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn((cb) => cb(mockDbClient)),
    };
    repository = new DrizzleLessonRepository(mockDbClient, getTextProcessor());
  });

  describe("findSourceText", () => {
    it("returns the source text when found and not soft-deleted", async () => {
      const row = {
        id: "st-1",
        userId: "user-1",
        content: "Hello world",
        title: "Test",
        contentHash: "abc123",
        createdAt: new Date(),
        deletedAt: null,
      };
      mockDbClient.select.mockReturnValueOnce(mockChain([row]));

      const result = await repository.findSourceText("st-1", "user-1");

      expect(result).toEqual(row);
    });

    it("returns null when no row is returned", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([]));

      const result = await repository.findSourceText("st-missing", "user-1");

      expect(result).toBeNull();
    });

    it("returns null when deleted row (soft-deleted — DB filter returns empty)", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([]));

      const result = await repository.findSourceText("st-deleted", "user-1");

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getSourceTextsCount
  // ---------------------------------------------------------------------------
  describe("getSourceTextsCount", () => {
    it("returns the count from the database", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([{ value: 5 }]));

      const result = await repository.getSourceTextsCount("user-1");

      expect(result).toBe(5);
    });

    it("returns 0 when the query returns an empty row", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([]));

      const result = await repository.getSourceTextsCount("user-1");

      expect(result).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // findLesson
  // ---------------------------------------------------------------------------
  describe("findLesson", () => {
    it("returns the lesson with correct shape when found", async () => {
      const row = {
        id: "les-1",
        sourceTextId: "st-1",
        userId: "user-1",
        version: 1,
        title: "My lesson",
        analysisStatus: "succeeded",
        exerciseStatus: "succeeded",
        textType: "article",
        inputMode: "understand_and_practice",
        detectedLevel: "B1",
        summaryVi: "Tóm tắt",
        naturalTranslationVi: "Dịch tự nhiên",
        contextExplanationVi: "Giải thích",
        exerciseModel: "gpt-4o",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDbClient.select.mockReturnValueOnce(mockChain([row]));

      const result = await repository.findLesson("les-1", "user-1");

      expect(result).toEqual(row);
      expect(result?.analysisStatus).toBe("succeeded");
      expect(result?.id).toBe("les-1");
    });

    it("returns null when lesson is not found", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([]));

      const result = await repository.findLesson("les-missing", "user-1");

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findLatestLesson
  // ---------------------------------------------------------------------------
  describe("findLatestLesson", () => {
    it("returns the most recent lesson for a source text", async () => {
      const row = {
        id: "les-2",
        sourceTextId: "st-1",
        userId: "user-1",
        version: 2,
        title: "Regeneration 2",
        analysisStatus: "pending",
        exerciseStatus: "pending",
        textType: null,
        inputMode: "understand_and_practice",
        detectedLevel: null,
        summaryVi: null,
        naturalTranslationVi: null,
        contextExplanationVi: null,
        exerciseModel: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDbClient.select.mockReturnValueOnce(mockChain([row]));

      const result = await repository.findLatestLesson("st-1");

      expect(result).toEqual(row);
      expect(result?.version).toBe(2);
    });

    it("returns null when there are no lessons for the source text", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([]));

      const result = await repository.findLatestLesson("st-no-lessons");

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // updateLessonStatus
  // ---------------------------------------------------------------------------
  describe("updateLessonStatus", () => {
    it("resolves without error when updating analysis stage to running", async () => {
      mockDbClient.update.mockReturnValueOnce(mockChain([]));

      await expect(
        repository.updateLessonStatus("les-1", "analysis", "running")
      ).resolves.toBeUndefined();
    });

    it("resolves without error when updating exercise stage with extra fields", async () => {
      mockDbClient.update.mockReturnValueOnce(mockChain([]));

      await expect(
        repository.updateLessonStatus("les-1", "exercise", "succeeded", {
          exerciseModel: "gpt-4o",
        })
      ).resolves.toBeUndefined();
    });

    it("resolves without error when marking analysis as failed", async () => {
      mockDbClient.update.mockReturnValueOnce(mockChain([]));

      await expect(
        repository.updateLessonStatus("les-1", "analysis", "failed")
      ).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getRecentLessons
  // ---------------------------------------------------------------------------
  describe("getRecentLessons", () => {
    it("returns an array of recent lesson summaries", async () => {
      const rows = [
        {
          id: "les-1",
          title: "Lesson A",
          version: 1,
          analysisStatus: "succeeded",
          exerciseStatus: "succeeded",
          textType: "article",
          inputMode: "understand_and_practice",
          detectedLevel: "B1",
          createdAt: new Date(),
        },
        {
          id: "les-2",
          title: "Lesson B",
          version: 1,
          analysisStatus: "pending",
          exerciseStatus: "pending",
          textType: null,
          inputMode: "understand_and_practice",
          detectedLevel: null,
          createdAt: new Date(),
        },
      ];
      mockDbClient.select.mockReturnValueOnce(mockChain(rows));

      const result = await repository.getRecentLessons("user-1", 10);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("les-1");
      expect(result[0].textType).toBe("article");
      expect(result[1].textType).toBe("unknown");
    });

    it("returns an empty array when the user has no lessons", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([]));

      const result = await repository.getRecentLessons("user-new", 10);

      expect(result).toEqual([]);
    });
  });

  describe("saveAnalysis", () => {
    it("throws an error when the lesson is not found", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([]));

      const dummyAnalysis = {
        title: "Test Lesson",
        textType: "general" as any,
        inputMode: "understand_and_practice",
        detectedLevel: "B1" as any,
        summaryVi: "Tóm tắt",
        naturalTranslationVi: "Dịch tự nhiên",
        contextExplanationVi: "Giải thích",
        keyPhrases: [],
        sentenceBreakdowns: [],
        lessonFocuses: [],
      };

      await expect(
        repository.saveAnalysis(
          "les-missing",
          "user-1",
          dummyAnalysis,
          "gemini-model"
        )
      ).rejects.toThrow("Lesson les-missing not found.");
    });

    it("throws an error when the source text is not found", async () => {
      mockDbClient.select
        .mockReturnValueOnce(mockChain([{ sourceTextId: "st-missing" }]))
        .mockReturnValueOnce(mockChain([]));

      const dummyAnalysis = {
        title: "Test Lesson",
        textType: "general" as any,
        inputMode: "understand_and_practice",
        detectedLevel: "B1" as any,
        summaryVi: "Tóm tắt",
        naturalTranslationVi: "Dịch tự nhiên",
        contextExplanationVi: "Giải thích",
        keyPhrases: [],
        sentenceBreakdowns: [],
        lessonFocuses: [],
      };

      await expect(
        repository.saveAnalysis(
          "les-1",
          "user-1",
          dummyAnalysis,
          "gemini-model"
        )
      ).rejects.toThrow("Source text st-missing not found.");
    });

    it("deduplicates overlapping key phrases using source text content and saves only the clean set", async () => {
      mockDbClient.select
        .mockReturnValueOnce(mockChain([{ sourceTextId: "st-1" }]))
        .mockReturnValueOnce(
          mockChain([{ content: "We need to push this back." }])
        );

      mockDbClient.update.mockReturnValue(mockChain([]));

      const mockValues = vi.fn().mockImplementation(() => mockChain([]));
      const mockInsert = vi.fn().mockImplementation(() => ({
        values: mockValues,
      }));
      mockDbClient.insert = mockInsert;

      const overlappingAnalysis = {
        title: "Test Lesson",
        textType: "general" as any,
        inputMode: "understand_and_practice",
        detectedLevel: "B1" as any,
        summaryVi: "Tóm tắt",
        naturalTranslationVi: "Dịch tự nhiên",
        contextExplanationVi: "Giải thích",
        keyPhrases: [
          {
            phrase: "push back",
            conceptKey: "push_back",
            conceptPhrase: "push back",
            conceptMeaningVi: "hoãn lại",
            meaningVi: "hoãn lại",
            meaningInContextVi: "dời lại",
            examples: [],
            category: "phrasal_verb" as any,
            difficulty: "B1" as any,
          },
          {
            phrase: "push this back",
            conceptKey: "push_back",
            conceptPhrase: "push back",
            conceptMeaningVi: "hoãn lại",
            meaningVi: "hoãn lại",
            meaningInContextVi: "dời việc này lại",
            examples: [],
            category: "phrasal_verb" as any,
            difficulty: "B1" as any,
          },
        ],
        sentenceBreakdowns: [],
        lessonFocuses: [],
      };

      await repository.saveAnalysis(
        "les-1",
        "user-1",
        overlappingAnalysis,
        "gemini-model"
      );

      expect(mockDbClient.update).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalled();

      const insertedValues = mockValues.mock.calls[0][0];
      expect(insertedValues).toHaveLength(1);
      expect(insertedValues[0].phrase).toBe("push this back");
    });
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
      mockDbClient.select.mockReturnValueOnce(mockChain([]));
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
      mockDbClient.select.mockReturnValueOnce(mockChain([{ text: thought }]));

      await repository.recordThought({
        lessonId: "les-1",
        generationJobId: "job-1",
        stage: "analysis",
        text: thought,
      });

      expect(mockDbClient.insert).not.toHaveBeenCalled();
    });

    it("skips all DB calls when text is empty after sanitization", async () => {
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
      mockDbClient.select.mockReturnValueOnce(mockChain([lessonRow]));
      mockDbClient.select.mockReturnValueOnce(mockChain([jobRow]));
      mockDbClient.select.mockReturnValueOnce(mockChain([milestoneRow]));
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
      mockDbClient.select.mockReturnValueOnce(mockChain([]));

      const result = await repository.getLessonProgress({
        lessonId: "les-missing",
        userId: "user-1",
      });

      expect(result).toBeNull();
    });

    it("returns empty milestones and thoughts when no job exists", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([lessonRow]));
      mockDbClient.select.mockReturnValueOnce(mockChain([]));

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
      mockDbClient.select.mockReturnValueOnce(mockChain([lessonRow]));
      mockDbClient.select.mockReturnValueOnce(mockChain([jobRow]));
      mockDbClient.select.mockReturnValueOnce(mockChain([]));
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
