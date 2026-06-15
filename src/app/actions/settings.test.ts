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
import { saveUserApiKeyAction, getUsageStatsAction } from "./settings";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth guards
vi.mock("@/lib/auth/guards", () => ({
  requireUser: vi.fn(),
}));

// Mock GoogleGenAI SDK
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation((config) => {
      return {
        models: {
          generateContent: vi.fn().mockImplementation(() => {
            if (config.apiKey === "invalid-fake-key") {
              throw new Error("API key not valid");
            }
            return { text: "OK" };
          }),
        },
      };
    }),
  };
});

describe("Settings Actions", () => {
  let testUser: any;

  beforeAll(async () => {
    // Set up test encryption key
    process.env.ENCRYPTION_SECRET = "settings-test-secret-key-123456789";

    // Clean up user
    await db
      .delete(schema.users)
      .where(eq(schema.users.email, "settings-test@example.com"));

    // Insert user
    [testUser] = await db
      .insert(schema.users)
      .values({
        email: "settings-test@example.com",
        name: "Settings Test User",
        role: "user",
      })
      .returning();
  });

  afterAll(async () => {
    // Clean up
    await db
      .delete(schema.aiRequests)
      .where(eq(schema.aiRequests.userId, testUser.id));
    await db.delete(schema.users).where(eq(schema.users.id, testUser.id));
  });

  beforeEach(() => {
    vi.mocked(requireUser).mockResolvedValue({
      id: testUser.id,
      email: testUser.email,
      role: "user",
    } as any);
  });

  describe("saveUserApiKeyAction", () => {
    it("fails and does not save the key if the Gemini validation call fails", async () => {
      const formData = new FormData();
      formData.append("apiKey", "invalid-fake-key");

      const result = await saveUserApiKeyAction(null, formData);
      expect(result).toEqual({
        error: "Xác thực API Key thất bại: API key not valid",
      });

      // Verify DB still does not have custom key
      const [user] = await db
        .select({ key: schema.users.customGeminiApiKey })
        .from(schema.users)
        .where(eq(schema.users.id, testUser.id));
      expect(user.key).toBeNull();
    });

    it("succeeds and saves the encrypted key if validation passes", async () => {
      const formData = new FormData();
      formData.append("apiKey", "AIzaSyValidKey123");

      const result = await saveUserApiKeyAction(null, formData);
      expect(result).toEqual({ success: true });

      // Verify DB has custom key configured
      const [user] = await db
        .select({ key: schema.users.customGeminiApiKey })
        .from(schema.users)
        .where(eq(schema.users.id, testUser.id));
      expect(user.key).not.toBeNull();
    });

    it("succeeds and clears the key if key input is empty", async () => {
      const formData = new FormData();
      formData.append("apiKey", "");

      const result = await saveUserApiKeyAction(null, formData);
      expect(result).toEqual({ success: true });

      // Verify DB has custom key cleared
      const [user] = await db
        .select({ key: schema.users.customGeminiApiKey })
        .from(schema.users)
        .where(eq(schema.users.id, testUser.id));
      expect(user.key).toBeNull();
    });
  });

  describe("getUsageStatsAction", () => {
    beforeAll(async () => {
      // Seed some test request records in DB
      await db
        .delete(schema.aiRequests)
        .where(eq(schema.aiRequests.userId, testUser.id));

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      await db.insert(schema.aiRequests).values([
        {
          userId: testUser.id,
          purpose: "analysis",
          provider: "gemini",
          model: "gemini-3.1-flash-lite",
          promptVersion: "1.0",
          schemaVersion: "analysis",
          payloadHash: "hash-1",
          status: "succeeded",
          latencyMs: 1200,
          inputTokens: 100,
          outputTokens: 200,
          costMicros: 0,
          createdAt: now,
        },
        {
          userId: testUser.id,
          purpose: "grading",
          provider: "gemini",
          model: "gemini-3.1-flash-lite",
          promptVersion: "1.0",
          schemaVersion: "grading",
          payloadHash: "hash-2",
          status: "succeeded",
          latencyMs: 800,
          inputTokens: 50,
          outputTokens: 50,
          costMicros: 0,
          createdAt: yesterday,
        },
        {
          userId: testUser.id,
          purpose: "exercise_generation",
          provider: "gemini",
          model: "gemini-3.1-flash-lite",
          promptVersion: "1.0",
          schemaVersion: "exercises",
          payloadHash: "hash-3",
          status: "failed",
          latencyMs: 500,
          inputTokens: 0,
          outputTokens: 0,
          costMicros: 0,
          createdAt: twoDaysAgo,
          errorMessage: "Quota exceeded",
        } as any,
      ]);
    });

    it("correctly aggregates stats for '30days' timeframe", async () => {
      const stats = await getUsageStatsAction("30days");
      expect(stats.summary.totalRequests).toBe(3);
      expect(stats.summary.successRate).toBe(67); // 2/3 * 100
      expect(stats.summary.totalTokens).toBe(400); // 300 + 100
      expect(stats.summary.avgLatencySec).toBe(1.0); // (1200 + 800) / 2 = 1000ms = 1.0s
      expect(stats.recent.length).toBe(3);
      expect(stats.daily.length).toBeGreaterThanOrEqual(2);
      expect((stats.recent[2] as any).errorMessage).toBe("Quota exceeded");
    });

    it("correctly filters stats for 'today' timeframe", async () => {
      const stats = await getUsageStatsAction("today");
      expect(stats.summary.totalRequests).toBe(1);
      expect(stats.summary.successRate).toBe(100);
      expect(stats.summary.totalTokens).toBe(300);
    });
  });
});
