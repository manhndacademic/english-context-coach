import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";
vi.unmock("@/db");
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guards";
import { notifyJobQueued } from "@/lib/jobs/trigger";
import {
  retryReviewPromptGenerationAction,
  retryPhrasePracticePromptGenerationAction,
} from "./review";
import crypto from "crypto";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth guards
vi.mock("@/lib/auth/guards", () => ({
  requireUser: vi.fn(),
}));

// Mock job trigger
vi.mock("@/lib/jobs/trigger", () => ({
  notifyJobQueued: vi.fn().mockResolvedValue(undefined),
}));

describe("Review Actions", () => {
  let testUser: any;
  let testPattern: any;

  beforeAll(async () => {
    // Set up a clean test user
    await db
      .delete(schema.users)
      .where(eq(schema.users.email, "review-action-test@example.com"));

    [testUser] = await db
      .insert(schema.users)
      .values({
        email: "review-action-test@example.com",
        name: "Review Test User",
        role: "user",
      })
      .returning();
  });

  afterAll(async () => {
    await db
      .delete(schema.mistakePatterns)
      .where(eq(schema.mistakePatterns.userId, testUser.id));
    await db
      .delete(schema.phrasePractices)
      .where(eq(schema.phrasePractices.userId, testUser.id));
    await db.delete(schema.users).where(eq(schema.users.id, testUser.id));
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clean patterns
    await db
      .delete(schema.mistakePatterns)
      .where(eq(schema.mistakePatterns.userId, testUser.id));
    await db
      .delete(schema.phrasePractices)
      .where(eq(schema.phrasePractices.userId, testUser.id));

    // Seed a mistake pattern
    [testPattern] = await db
      .insert(schema.mistakePatterns)
      .values({
        userId: testUser.id,
        conceptKey: "test-retry-concept",
        errorType: "literal_translation",
        category: "general_phrase",
        normalizedPhrase: "retry phrase",
        meaningVi: "nghĩa retry",
        safeReviewPromptVi: "prompt retry",
        reviewPromptStatus: "failed",
        reviewPromptAttempts: 3,
        reviewPromptError: "LLM error",
      })
      .returning();

    // Mock authenticated user
    vi.mocked(requireUser).mockResolvedValue({
      id: testUser.id,
      email: testUser.email,
      role: "user",
    } as any);
  });

  it("fails if the pattern does not exist or does not belong to the user", async () => {
    const formData = new FormData();
    formData.append("patternId", crypto.randomUUID());

    const result = (await retryReviewPromptGenerationAction(
      null,
      formData
    )) as any;
    expect(result).toHaveProperty("error");
    expect(result.error).toContain(
      "Không tìm thấy mẫu lỗi hoặc bạn không có quyền"
    );
    expect(notifyJobQueued).not.toHaveBeenCalled();
  });

  it("updates job status to queued and calls notifyJobQueued on success", async () => {
    const formData = new FormData();
    formData.append("patternId", testPattern.id);

    const result = await retryReviewPromptGenerationAction(null, formData);
    // Success actions don't return error
    expect(result).toBeUndefined();

    // Check DB state is updated
    const [updated] = await db
      .select()
      .from(schema.mistakePatterns)
      .where(eq(schema.mistakePatterns.id, testPattern.id));

    expect(updated.reviewPromptStatus).toBe("queued");
    expect(updated.reviewPromptAttempts).toBe(0);
    expect(updated.reviewPromptError).toBeNull();

    // MUST call notifyJobQueued to wake up workers
    expect(notifyJobQueued).toHaveBeenCalledTimes(1);
  });

  describe("Phrase Practice Actions", () => {
    let testPractice: any;

    beforeEach(async () => {
      [testPractice] = await db
        .insert(schema.phrasePractices)
        .values({
          userId: testUser.id,
          conceptKey: "test-retry-phrase-concept",
          senseKey: "default",
          category: "general_phrase",
          normalizedPhrase: "phrase practice target",
          meaningVi: "nghĩa luyện tập",
          safeReviewPromptVi: "prompt luyện tập",
          reviewPromptStatus: "failed",
          reviewPromptAttempts: 3,
          reviewPromptError: "LLM error",
        })
        .returning();
    });

    it("fails to retry if the practice does not exist or does not belong to the user", async () => {
      const formData = new FormData();
      formData.append("practiceId", crypto.randomUUID());

      const result = (await retryPhrasePracticePromptGenerationAction(
        null,
        formData
      )) as any;
      expect(result).toHaveProperty("error");
      expect(result.error).toContain(
        "Không tìm thấy cụm từ hoặc bạn không có quyền"
      );
      expect(notifyJobQueued).not.toHaveBeenCalled();
    });

    it("updates practice job status to queued and calls notifyJobQueued on success", async () => {
      const formData = new FormData();
      formData.append("practiceId", testPractice.id);

      const result = await retryPhrasePracticePromptGenerationAction(
        null,
        formData
      );
      expect(result).toBeUndefined();

      // Check DB state is updated
      const [updated] = await db
        .select()
        .from(schema.phrasePractices)
        .where(eq(schema.phrasePractices.id, testPractice.id));

      expect(updated.reviewPromptStatus).toBe("queued");
      expect(updated.reviewPromptAttempts).toBe(0);
      expect(updated.reviewPromptError).toBeNull();

      expect(notifyJobQueued).toHaveBeenCalledTimes(1);
    });
  });
});
