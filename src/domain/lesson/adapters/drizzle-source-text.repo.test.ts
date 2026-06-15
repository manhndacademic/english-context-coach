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

describe("DrizzleLessonRepository — SourceText methods", () => {
  let repository: DrizzleLessonRepository;
  let mockDbClient: any;

  beforeEach(() => {
    mockDbClient = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn(),
      transaction: vi.fn((cb) => cb(mockDbClient)),
    };
    repository = new DrizzleLessonRepository(mockDbClient, getTextProcessor());
  });

  // ---------------------------------------------------------------------------
  // findSourceText
  // ---------------------------------------------------------------------------
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
      // The SQL `is null` predicate on deletedAt causes DB to return empty
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
      // null textType is normalized to 'unknown'
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
});
