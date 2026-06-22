import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ApiKeyRepository } from "../ports";

export class DrizzleApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly dbClient = db) {}

  async getSystemKeys() {
    return await this.dbClient
      .select({
        id: schema.aiApiKeys.id,
        name: schema.aiApiKeys.name,
        encryptedKey: schema.aiApiKeys.encryptedKey,
        status: schema.aiApiKeys.status,
        rateLimitedAt: schema.aiApiKeys.rateLimitedAt,
      })
      .from(schema.aiApiKeys);
  }

  async getUserKeys(userId: string) {
    return await this.dbClient
      .select({
        id: schema.userAiApiKeys.id,
        encryptedKey: schema.userAiApiKeys.encryptedKey,
        status: schema.userAiApiKeys.status,
        rateLimitedAt: schema.userAiApiKeys.rateLimitedAt,
      })
      .from(schema.userAiApiKeys)
      .where(eq(schema.userAiApiKeys.userId, userId));
  }

  async getLegacyUserKey(userId: string): Promise<string | null> {
    const [user] = await this.dbClient
      .select({ customGeminiApiKey: schema.users.customGeminiApiKey })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return user?.customGeminiApiKey ?? null;
  }

  async updateKeyStatus(
    keyId: string,
    status: "active" | "rate_limited" | "invalid",
    errorMessage: string | null
  ): Promise<void> {
    const now = new Date();

    // Try updating user AI keys first
    const updatedUserKeys = await this.dbClient
      .update(schema.userAiApiKeys)
      .set({
        status,
        errorMessage,
        rateLimitedAt: status === "rate_limited" ? now : null,
        updatedAt: now,
      })
      .where(eq(schema.userAiApiKeys.id, keyId))
      .returning({ id: schema.userAiApiKeys.id });

    if (updatedUserKeys.length > 0) {
      return;
    }

    // Fall back to system API keys
    await this.dbClient
      .update(schema.aiApiKeys)
      .set({
        status,
        errorMessage,
        rateLimitedAt: status === "rate_limited" ? now : null,
        updatedAt: now,
      })
      .where(eq(schema.aiApiKeys.id, keyId));
  }

  async saveUserApiKey(
    userId: string,
    encryptedApiKey: string | null
  ): Promise<void> {
    await this.dbClient
      .update(schema.users)
      .set({
        customGeminiApiKey: encryptedApiKey,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));
  }
}
