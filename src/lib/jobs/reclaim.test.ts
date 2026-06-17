import {
  describe,
  expect,
  it,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
vi.unmock("@/db");
import { db, schema } from "@/db";
import { runReclaimWorker } from "./reclaim";
import { notifyJobQueued } from "@/lib/jobs/trigger";
import { eq, and } from "drizzle-orm";

vi.mock("@/lib/jobs/trigger", () => ({
  notifyJobQueued: vi.fn().mockResolvedValue(undefined),
}));

describe("Stale Job Reclamation Worker", () => {
  let testUser: any;
  let testSourceText: any;
  let testLesson: any;

  beforeAll(async () => {
    // Clean up test user if already exists
    await db
      .delete(schema.users)
      .where(eq(schema.users.email, "reclaim-test@example.com"));

    // Insert test user
    [testUser] = await db
      .insert(schema.users)
      .values({
        email: "reclaim-test@example.com",
        name: "Reclaim Test User",
      })
      .returning();

    // Insert test source text
    [testSourceText] = await db
      .insert(schema.sourceTexts)
      .values({
        userId: testUser.id,
        title: "Test Title",
        content: "Test Source Text Content",
        contentHash: "hash-test",
      })
      .returning();

    // Insert test lesson
    [testLesson] = await db
      .insert(schema.lessons)
      .values({
        userId: testUser.id,
        sourceTextId: testSourceText.id,
        title: "Reclaim Test Lesson",
        version: 1,
        inputMode: "understand_and_practice",
        analysisStatus: "running",
        exerciseStatus: "pending",
      })
      .returning();
  });

  afterAll(async () => {
    // Delete milestones, thoughts, jobs, lessons, sourceTexts, user
    if (testLesson?.id) {
      await db
        .delete(schema.generationMilestones)
        .where(eq(schema.generationMilestones.lessonId, testLesson.id));
      await db
        .delete(schema.generationThoughts)
        .where(eq(schema.generationThoughts.lessonId, testLesson.id));
      await db
        .delete(schema.generationJobs)
        .where(eq(schema.generationJobs.lessonId, testLesson.id));
      await db
        .delete(schema.lessons)
        .where(eq(schema.lessons.id, testLesson.id));
    }
    if (testSourceText?.id) {
      await db
        .delete(schema.sourceTexts)
        .where(eq(schema.sourceTexts.id, testSourceText.id));
    }
    if (testUser?.id) {
      await db
        .delete(schema.mistakePatterns)
        .where(eq(schema.mistakePatterns.userId, testUser.id));
      await db.delete(schema.users).where(eq(schema.users.id, testUser.id));
    }
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clean up generation jobs and mistake patterns for testUser
    if (testLesson?.id) {
      await db
        .delete(schema.generationMilestones)
        .where(eq(schema.generationMilestones.lessonId, testLesson.id));
      await db
        .delete(schema.generationJobs)
        .where(eq(schema.generationJobs.lessonId, testLesson.id));
    }
    if (testUser?.id) {
      await db
        .delete(schema.mistakePatterns)
        .where(eq(schema.mistakePatterns.userId, testUser.id));
    }
  });

  describe("generation_jobs reclamation", () => {
    it("should re-queue the job and reset lesson status to pending if attempts < 3", async () => {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      // Create a running job with attempts = 1
      const [job] = await db
        .insert(schema.generationJobs)
        .values({
          userId: testUser.id,
          sourceTextId: testSourceText.id,
          lessonId: testLesson.id,
          status: "running",
          stage: "analysis",
          attempts: 1,
          lockedAt: fifteenMinutesAgo,
          lockedBy: "worker-test",
        })
        .returning();

      // Ensure lesson is set to running for analysis
      await db
        .update(schema.lessons)
        .set({ analysisStatus: "running" })
        .where(eq(schema.lessons.id, testLesson.id));

      const result = await runReclaimWorker();

      expect(result.reclaimedLessons).toBe(1);
      expect(notifyJobQueued).toHaveBeenCalledTimes(1);

      // Verify job is reset to queued
      const [updatedJob] = await db
        .select()
        .from(schema.generationJobs)
        .where(eq(schema.generationJobs.id, job.id));

      expect(updatedJob.status).toBe("queued");
      expect(updatedJob.lockedAt).toBeNull();
      expect(updatedJob.lockedBy).toBeNull();

      // Verify lesson status is reset to pending
      const [updatedLesson] = await db
        .select()
        .from(schema.lessons)
        .where(eq(schema.lessons.id, testLesson.id));

      expect(updatedLesson.analysisStatus).toBe("pending");
    });

    it("should fail the job, fail the lesson stage, and record a milestone if attempts >= 3", async () => {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      // Create a running job with attempts = 3
      const [job] = await db
        .insert(schema.generationJobs)
        .values({
          userId: testUser.id,
          sourceTextId: testSourceText.id,
          lessonId: testLesson.id,
          status: "running",
          stage: "exercises",
          attempts: 3,
          lockedAt: fifteenMinutesAgo,
          lockedBy: "worker-test",
        })
        .returning();

      // Ensure lesson is set to running for exercise
      await db
        .update(schema.lessons)
        .set({ exerciseStatus: "running" })
        .where(eq(schema.lessons.id, testLesson.id));

      const result = await runReclaimWorker();

      expect(result.reclaimedLessons).toBe(1);
      // It should not trigger wake workers since no jobs were re-queued
      expect(notifyJobQueued).not.toHaveBeenCalled();

      // Verify job is failed
      const [updatedJob] = await db
        .select()
        .from(schema.generationJobs)
        .where(eq(schema.generationJobs.id, job.id));

      expect(updatedJob.status).toBe("failed");
      expect(updatedJob.errorMessage).toContain(
        "exceeded maximum execution attempts"
      );
      expect(updatedJob.lockedAt).toBeNull();
      expect(updatedJob.lockedBy).toBeNull();

      // Verify lesson status is set to failed
      const [updatedLesson] = await db
        .select()
        .from(schema.lessons)
        .where(eq(schema.lessons.id, testLesson.id));

      expect(updatedLesson.exerciseStatus).toBe("failed");

      // Verify milestone failed is recorded
      const milestones = await db
        .select()
        .from(schema.generationMilestones)
        .where(
          and(
            eq(schema.generationMilestones.generationJobId, job.id),
            eq(schema.generationMilestones.code, "failed")
          )
        );

      expect(milestones).toHaveLength(1);
      expect(milestones[0].stage).toBe("exercises");
    });
  });

  describe("mistake_patterns reclamation", () => {
    it("should re-queue review prompt status if attempts < 3", async () => {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      const [pattern] = await db
        .insert(schema.mistakePatterns)
        .values({
          userId: testUser.id,
          conceptKey: "concept-test",
          normalizedPhrase: "test phrase",
          category: "general_phrase",
          errorType: "literal_translation",
          meaningVi: "nghĩa test",
          safeReviewPromptVi: "prompt",
          reviewPromptStatus: "running",
          reviewPromptLockedAt: fifteenMinutesAgo,
          reviewPromptLockedBy: "worker-test",
          reviewPromptAttempts: 1,
        })
        .returning();

      const result = await runReclaimWorker();

      expect(result.reclaimedMistakePatterns).toBe(1);
      expect(notifyJobQueued).toHaveBeenCalledTimes(1);

      // Verify pattern review status is reset
      const [updatedPattern] = await db
        .select()
        .from(schema.mistakePatterns)
        .where(eq(schema.mistakePatterns.id, pattern.id));

      expect(updatedPattern.reviewPromptStatus).toBe("queued");
      expect(updatedPattern.reviewPromptLockedAt).toBeNull();
      expect(updatedPattern.reviewPromptLockedBy).toBeNull();
    });

    it("should fail review prompt status if attempts >= 3", async () => {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      const [pattern] = await db
        .insert(schema.mistakePatterns)
        .values({
          userId: testUser.id,
          conceptKey: "concept-test",
          normalizedPhrase: "test phrase",
          category: "general_phrase",
          errorType: "literal_translation",
          meaningVi: "nghĩa test",
          safeReviewPromptVi: "prompt",
          reviewPromptStatus: "running",
          reviewPromptLockedAt: fifteenMinutesAgo,
          reviewPromptLockedBy: "worker-test",
          reviewPromptAttempts: 3,
        })
        .returning();

      const result = await runReclaimWorker();

      expect(result.reclaimedMistakePatterns).toBe(1);
      expect(notifyJobQueued).not.toHaveBeenCalled();

      // Verify pattern review status is failed
      const [updatedPattern] = await db
        .select()
        .from(schema.mistakePatterns)
        .where(eq(schema.mistakePatterns.id, pattern.id));

      expect(updatedPattern.reviewPromptStatus).toBe("failed");
      expect(updatedPattern.reviewPromptError).toContain(
        "exceeded maximum execution attempts"
      );
      expect(updatedPattern.reviewPromptLockedAt).toBeNull();
      expect(updatedPattern.reviewPromptLockedBy).toBeNull();
    });
  });
});
