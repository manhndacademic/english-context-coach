import {
  beforeAll,
  afterAll,
  describe,
  expect,
  it,
  vi,
  beforeEach,
} from "vitest";
vi.unmock("@/db");
import { db, schema } from "@/db";
import { encryptApiKey } from "@/lib/crypto";
import {
  GeminiLLMProvider,
  parseApiKeys,
} from "@/domain/ai/adapters/gemini-provider";
import { DrizzleKeyResolver } from "@/domain/ai/adapters/key-resolver";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Prompt } from "@/domain/ai/ports";
import type { AiPurpose, AiModelKind } from "@/domain/types";

function createTestPrompt(options: {
  purpose: AiPurpose;
  prompt: string;
  promptVersion: string;
  schemaVersion: string;
  schema: z.ZodTypeAny;
  modelKind: AiModelKind;
  expectedShape?: Record<string, any>;
}): Prompt<any> {
  return {
    purpose: options.purpose,
    promptVersion: options.promptVersion,
    schemaVersion: options.schemaVersion,
    schema: options.schema,
    modelKind: options.modelKind,
    render: () => options.prompt,
    expectedShape: options.expectedShape,
  };
}

describe("AI Key Rotation & Error Handling", () => {
  let testUser: any;
  let provider: GeminiLLMProvider;

  beforeEach(() => {
    DrizzleKeyResolver.resetEnvKeysForTest();
  });

  beforeAll(async () => {
    // Set up test encryption key
    process.env.ENCRYPTION_SECRET = "rotation-test-secret-key-123456789012";
    provider = new GeminiLLMProvider();

    // Clean up
    await db.delete(schema.aiApiKeys);
    await db
      .delete(schema.users)
      .where(eq(schema.users.email, "rotation-test@example.com"));

    // Create a test user
    [testUser] = await db
      .insert(schema.users)
      .values({
        email: "rotation-test@example.com",
        name: "Rotation Test User",
        role: "user",
      })
      .returning();
  });

  afterAll(async () => {
    // Clean up
    await db.delete(schema.aiApiKeys);
    if (testUser) {
      await db.delete(schema.users).where(eq(schema.users.id, testUser.id));
    }
  });

  it("should use user-provided API key if set on user record", async () => {
    // Set custom API key for user
    const fakeUserKey = "AIzaSyUserKey123";
    await db
      .update(schema.users)
      .set({ customGeminiApiKey: encryptApiKey(fakeUserKey) })
      .where(eq(schema.users.id, testUser.id));

    const prompt = createTestPrompt({
      purpose: "repair",
      prompt: "Hello",
      promptVersion: "1.0",
      schemaVersion: "grading",
      schema: z.object({ isCorrect: z.boolean() }),
      modelKind: "fast",
    });

    await expect(
      provider.generateJson({
        userId: testUser.id,
        prompt,
      })
    ).rejects.toThrow("Custom User API Key failed");
  });

  it("should rotate between multiple user-provided API keys and fail only when all are exhausted", async () => {
    // Save multiple fake user keys (as a JSON array of encrypted keys)
    const fakeKeys = ["AIzaSyUserKey1", "AIzaSyUserKey2"];
    const encryptedArray = JSON.stringify(
      fakeKeys.map((k) => encryptApiKey(k))
    );
    await db
      .update(schema.users)
      .set({ customGeminiApiKey: encryptedArray })
      .where(eq(schema.users.id, testUser.id));

    const prompt = createTestPrompt({
      purpose: "repair",
      prompt: "Hello",
      promptVersion: "1.0",
      schemaVersion: "grading",
      schema: z.object({ isCorrect: z.boolean() }),
      modelKind: "fast",
    });

    await expect(
      provider.generateJson({
        userId: testUser.id,
        prompt,
      })
    ).rejects.toThrow("Custom User API Key failed");
  });

  it("should rotately mark rate-limited keys and exclude them", async () => {
    // Remove user key to test system keys
    await db
      .update(schema.users)
      .set({ customGeminiApiKey: null })
      .where(eq(schema.users.id, testUser.id));

    // Insert two invalid system keys
    await db.insert(schema.aiApiKeys).values({
      name: "System Key 1",
      provider: "gemini",
      encryptedKey: encryptApiKey("AIzaSySystemKey1"),
      status: "active",
    });

    await db.insert(schema.aiApiKeys).values({
      name: "System Key 2",
      provider: "gemini",
      encryptedKey: encryptApiKey("AIzaSySystemKey2"),
      status: "active",
    });

    const prompt = createTestPrompt({
      purpose: "repair",
      prompt: "Hello",
      promptVersion: "1.0",
      schemaVersion: "grading",
      schema: z.object({ isCorrect: z.boolean() }),
      modelKind: "fast",
    });

    // Temporarily remove fallback key to force system key failure
    const originalEnvKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      // Since both system keys are invalid API keys, the rotation loop will try them and mark them as invalid.
      await expect(
        provider.generateJson({
          userId: testUser.id,
          prompt,
        })
      ).rejects.toThrow();

      // Check that both keys were marked as invalid in the database
      const dbKeys = await db.select().from(schema.aiApiKeys);
      expect(dbKeys.map((k) => k.status)).toContain("invalid");
    } finally {
      process.env.GEMINI_API_KEY = originalEnvKey;
    }
  });

  it("should rotately try multiple keys configured in GEMINI_API_KEYS", async () => {
    await db
      .update(schema.users)
      .set({ customGeminiApiKey: null })
      .where(eq(schema.users.id, testUser.id));
    await db.delete(schema.aiApiKeys);

    const originalEnvKey = process.env.GEMINI_API_KEY;
    const originalEnvKeys = process.env.GEMINI_API_KEYS;

    process.env.GEMINI_API_KEYS = "AIzaSyEnvKey1,AIzaSyEnvKey2";
    delete process.env.GEMINI_API_KEY;

    try {
      const prompt = createTestPrompt({
        purpose: "repair",
        prompt: "Hello",
        promptVersion: "1.0",
        schemaVersion: "grading",
        schema: z.object({ isCorrect: z.boolean() }),
        modelKind: "fast",
      });

      await expect(
        provider.generateJson({
          userId: testUser.id,
          prompt,
        })
      ).rejects.toThrow();
    } finally {
      process.env.GEMINI_API_KEY = originalEnvKey;
      process.env.GEMINI_API_KEYS = originalEnvKeys;
    }
  });

  it("should save user custom API key using getKeyResolver()", async () => {
    const { getKeyResolver } = await import("@/domain/ai");
    const keyResolver = getKeyResolver();
    const encryptedKey = encryptApiKey("my-new-secret-user-key");

    await keyResolver.saveUserApiKey(testUser.id, encryptedKey);

    const [updatedUser] = await db
      .select({ customGeminiApiKey: schema.users.customGeminiApiKey })
      .from(schema.users)
      .where(eq(schema.users.id, testUser.id))
      .limit(1);

    expect(updatedUser.customGeminiApiKey).toBe(encryptedKey);
  });

  it("should not exclude keys or mark them rate-limited on JSON schema validation errors", async () => {
    // Clean keys and insert a valid-looking system key in DB
    await db.delete(schema.aiApiKeys);
    const [systemKey] = await db
      .insert(schema.aiApiKeys)
      .values({
        name: "Mocked System Key",
        provider: "gemini",
        encryptedKey: encryptApiKey("AIzaSyMockedSystemKey"),
        status: "active",
      })
      .returning();

    // Mock callGeminiRaw to succeed but return invalid JSON
    const rawSpy = vi
      .spyOn(provider as any, "callGeminiRaw")
      .mockResolvedValue({
        text: '{"wrong_fields": true}',
        inputTokens: 10,
        outputTokens: 10,
      });

    const prompt = createTestPrompt({
      purpose: "grading",
      prompt: "Hello",
      promptVersion: "1.0",
      schemaVersion: "grading",
      schema: z.object({ score: z.number(), isCorrect: z.boolean() }),
      modelKind: "fast",
      expectedShape: { score: "number", isCorrect: "boolean" },
    });

    // It should fail due to validation error (after repair also returns wrong_fields)
    await expect(
      provider.generateJson({
        userId: testUser.id,
        prompt,
      })
    ).rejects.toThrow();

    // Verify raw API was called
    expect(rawSpy).toHaveBeenCalled();

    // Check that the system key was NOT marked rate-limited or invalid in DB
    const [keyInDb] = await db
      .select()
      .from(schema.aiApiKeys)
      .where(eq(schema.aiApiKeys.id, systemKey.id));

    expect(keyInDb.status).toBe("active");
  });

  describe("parseApiKeys", () => {
    it("should handle undefined and empty strings", () => {
      expect(parseApiKeys(undefined)).toEqual([]);
      expect(parseApiKeys("")).toEqual([]);
      expect(parseApiKeys("   ")).toEqual([]);
    });

    it("should parse comma-separated keys", () => {
      expect(parseApiKeys("key1,key2,key3")).toEqual(["key1", "key2", "key3"]);
      expect(parseApiKeys("  key1 , key2,key3  ")).toEqual([
        "key1",
        "key2",
        "key3",
      ]);
    });

    it("should parse newline-separated keys", () => {
      expect(parseApiKeys("key1\nkey2\nkey3")).toEqual([
        "key1",
        "key2",
        "key3",
      ]);
      expect(parseApiKeys("\nkey1\n\nkey2\n")).toEqual(["key1", "key2"]);
    });

    it("should parse mixed comma and newline-separated keys", () => {
      expect(parseApiKeys("key1,key2\nkey3, key4")).toEqual([
        "key1",
        "key2",
        "key3",
        "key4",
      ]);
    });

    it("should strip inline comments starting with # or //", () => {
      const input = `
        key1 # first account key
        key2 // second account key
        key3,key4 # multiple on same line
      `;
      expect(parseApiKeys(input)).toEqual(["key1", "key2", "key3", "key4"]);
    });
  });
});
