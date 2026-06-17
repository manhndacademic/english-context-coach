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
import { runDigestWorker, digestWorkerInternals } from "./digestWorker";
import { sendDigestEmail } from "@/lib/email/sendDigestEmail";
import { eq } from "drizzle-orm";

vi.mock("@/lib/email/sendDigestEmail", () => ({
  sendDigestEmail: vi.fn(),
}));

describe("DigestWorker Race Condition & Claiming", () => {
  let testUser: any;
  const digestDate = "2026-06-16";

  beforeAll(async () => {
    // Make sure we have a clean state for the test user
    await db
      .delete(schema.users)
      .where(eq(schema.users.email, "digest-test@example.com"));

    // Insert user
    [testUser] = await db
      .insert(schema.users)
      .values({
        email: "digest-test@example.com",
        name: "Digest Test User",
        emailDigestEnabled: true,
        emailDigestHour: (new Date().getUTCHours() + 7) % 24, // current VN hour
      })
      .returning();
  });

  afterAll(async () => {
    await db
      .delete(schema.emailDigestLogs)
      .where(eq(schema.emailDigestLogs.userId, testUser.id));
    await db
      .delete(schema.mistakePatterns)
      .where(eq(schema.mistakePatterns.userId, testUser.id));
    await db.delete(schema.users).where(eq(schema.users.id, testUser.id));
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    // Clean logs and mistake patterns for testUser
    await db
      .delete(schema.emailDigestLogs)
      .where(eq(schema.emailDigestLogs.userId, testUser.id));
    await db
      .delete(schema.mistakePatterns)
      .where(eq(schema.mistakePatterns.userId, testUser.id));

    // Mock the date helper to return our stable test date
    vi.spyOn(digestWorkerInternals, "currentVnDigestDate").mockReturnValue(
      digestDate
    );
  });

  it("skips processing if a log entry is already in 'processing' status", async () => {
    // Setup 1 due item
    await db.insert(schema.mistakePatterns).values({
      userId: testUser.id,
      conceptKey: "test-concept",
      errorType: "literal_translation",
      category: "general_phrase",
      normalizedPhrase: "test phrase",
      meaningVi: "nghĩa test",
      safeReviewPromptVi: "prompt",
      dueAt: new Date(Date.now() - 3600000), // due 1 hour ago
      masteryState: "active",
      reviewPromptStatus: "succeeded",
    });

    // Pre-insert a log with 'processing' status
    await db.insert(schema.emailDigestLogs).values({
      userId: testUser.id,
      digestDate,
      status: "processing",
      dueCount: 0,
    });

    // Run worker
    const results = await runDigestWorker();

    // It should skip this user
    expect(results.skipped).toBe(1);
    expect(results.sent).toBe(0);
    expect(sendDigestEmail).not.toHaveBeenCalled();
  });

  it("skips processing if a log entry is already in 'skipped' status", async () => {
    // Setup 1 due item
    await db.insert(schema.mistakePatterns).values({
      userId: testUser.id,
      conceptKey: "test-concept",
      errorType: "literal_translation",
      category: "general_phrase",
      normalizedPhrase: "test phrase",
      meaningVi: "nghĩa test",
      safeReviewPromptVi: "prompt",
      dueAt: new Date(Date.now() - 3600000), // due 1 hour ago
      masteryState: "active",
      reviewPromptStatus: "succeeded",
    });

    // Pre-insert a log with 'skipped' status
    await db.insert(schema.emailDigestLogs).values({
      userId: testUser.id,
      digestDate,
      status: "skipped",
      dueCount: 0,
    });

    const results = await runDigestWorker();

    expect(results.skipped).toBe(1);
    expect(results.sent).toBe(0);
    expect(sendDigestEmail).not.toHaveBeenCalled();
  });

  it("retries if the previous status was 'failed'", async () => {
    // Setup 1 due item so we try to send
    await db.insert(schema.mistakePatterns).values({
      userId: testUser.id,
      conceptKey: "test-concept",
      errorType: "literal_translation",
      category: "general_phrase",
      normalizedPhrase: "test phrase",
      meaningVi: "nghĩa test",
      safeReviewPromptVi: "prompt",
      dueAt: new Date(Date.now() - 3600000), // due 1 hour ago
      masteryState: "active",
      reviewPromptStatus: "succeeded",
    });

    // Pre-insert a log with 'failed' status
    await db.insert(schema.emailDigestLogs).values({
      userId: testUser.id,
      digestDate,
      status: "failed",
      dueCount: 0,
    });

    const results = await runDigestWorker();

    expect(results.sent).toBe(1);
    expect(sendDigestEmail).toHaveBeenCalledTimes(1);

    // Verify DB log is updated to 'sent'
    const [log] = await db
      .select()
      .from(schema.emailDigestLogs)
      .where(eq(schema.emailDigestLogs.userId, testUser.id));
    expect(log.status).toBe("sent");
  });

  it("skips user if they have due items but reviewPromptStatus is not 'succeeded'", async () => {
    // Setup 1 due item but with queued status
    await db.insert(schema.mistakePatterns).values({
      userId: testUser.id,
      conceptKey: "test-concept",
      errorType: "literal_translation",
      category: "general_phrase",
      normalizedPhrase: "test phrase",
      meaningVi: "nghĩa test",
      safeReviewPromptVi: "prompt",
      dueAt: new Date(Date.now() - 3600000), // due 1 hour ago
      masteryState: "active",
      reviewPromptStatus: "queued",
    });

    const results = await runDigestWorker();

    // Since reviewPromptStatus is "queued", dueCount is 0, so it skips the user
    expect(results.skipped).toBe(1);
    expect(results.sent).toBe(0);
    expect(sendDigestEmail).not.toHaveBeenCalled();

    // Verify the log entry is marked as skipped
    const [log] = await db
      .select()
      .from(schema.emailDigestLogs)
      .where(eq(schema.emailDigestLogs.userId, testUser.id));
    expect(log.status).toBe("skipped");
    expect(log.dueCount).toBe(0);
  });
});
