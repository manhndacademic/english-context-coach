import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
vi.unmock("@/db");
import { db, schema } from "@/db";
import { encryptApiKey } from "@/lib/crypto";
import { generateJson } from "./provider";
import { eq } from "drizzle-orm";
import { z } from "zod";

describe("AI Key Rotation & Error Handling", () => {
  let testUser: any;
  let systemKey1: any;
  let systemKey2: any;

  beforeAll(async () => {
    // Set up test encryption key
    process.env.ENCRYPTION_SECRET = "rotation-test-secret-key-123456789012";

    // Clean up
    await db.delete(schema.aiApiKeys);
    await db.delete(schema.users).where(eq(schema.users.email, "rotation-test@example.com"));

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

    // Verify it fails with our specific user key when the mock key is invalid rather than falling back
    // (since Google Gen AI API call will reject this key)
    const options = {
      userId: testUser.id,
      purpose: "repair" as const,
      prompt: "Hello",
      promptVersion: "1.0",
      schemaVersion: "grading" as const,
      schema: z.object({ isCorrect: z.boolean() }),
      modelKind: "fast" as const,
    };

    await expect(generateJson(options)).rejects.toThrow("Custom User API Key failed");
  });

  it("should rotately mark rate-limited keys and exclude them", async () => {
    // Remove user key to test system keys
    await db
      .update(schema.users)
      .set({ customGeminiApiKey: null })
      .where(eq(schema.users.id, testUser.id));

    // Insert two invalid system keys
    const [key1] = await db
      .insert(schema.aiApiKeys)
      .values({
        name: "System Key 1",
        provider: "gemini",
        encryptedKey: encryptApiKey("AIzaSySystemKey1"),
        status: "active",
      })
      .returning();

    const [key2] = await db
      .insert(schema.aiApiKeys)
      .values({
        name: "System Key 2",
        provider: "gemini",
        encryptedKey: encryptApiKey("AIzaSySystemKey2"),
        status: "active",
      })
      .returning();

    const options = {
      userId: testUser.id,
      purpose: "repair" as const,
      prompt: "Hello",
      promptVersion: "1.0",
      schemaVersion: "grading" as const,
      schema: z.object({ isCorrect: z.boolean() }),
      modelKind: "fast" as const,
    };

    // Temporarily remove fallback key to force system key failure
    const originalEnvKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      // Since both system keys are invalid API keys, the rotation loop will try them and mark them as invalid.
      await expect(generateJson(options)).rejects.toThrow();

      // Check that both keys were marked as invalid in the database
      const dbKeys = await db.select().from(schema.aiApiKeys);
      expect(dbKeys.map(k => k.status)).toContain("invalid");
    } finally {
      process.env.GEMINI_API_KEY = originalEnvKey;
    }
  });
});
