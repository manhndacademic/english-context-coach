import { and, eq } from "drizzle-orm";
import { db, schema, type DbClient } from "@/db";
import type { UserApiKeyRepository } from "../../application/ports/user-api-key-repository";
import type { UserApiKey } from "../../domain/types";

export class DrizzleUserApiKeyRepository implements UserApiKeyRepository {
  async add(
    userId: string,
    name: string,
    encryptedKey: string,
    keyFingerprint: string,
    dbClient: DbClient = db
  ): Promise<void> {
    await dbClient.insert(schema.userAiApiKeys).values({
      userId,
      provider: "gemini",
      name,
      encryptedKey,
      keyFingerprint,
      status: "active",
    });
  }

  async delete(
    userId: string,
    id: string,
    dbClient: DbClient = db
  ): Promise<void> {
    await dbClient
      .delete(schema.userAiApiKeys)
      .where(
        and(
          eq(schema.userAiApiKeys.id, id),
          eq(schema.userAiApiKeys.userId, userId)
        )
      );
  }

  async updateStatus(
    id: string,
    status: "active" | "disabled" | "invalid",
    errorMessage: string | null,
    dbClient: DbClient = db
  ): Promise<void> {
    await dbClient
      .update(schema.userAiApiKeys)
      .set({
        status,
        errorMessage,
        rateLimitedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.userAiApiKeys.id, id));
  }

  async findById(
    userId: string,
    id: string,
    dbClient: DbClient = db
  ): Promise<UserApiKey | null> {
    const [row] = await dbClient
      .select()
      .from(schema.userAiApiKeys)
      .where(
        and(
          eq(schema.userAiApiKeys.id, id),
          eq(schema.userAiApiKeys.userId, userId)
        )
      )
      .limit(1);

    return (row as UserApiKey) ?? null;
  }

  async countForUser(userId: string, dbClient: DbClient = db): Promise<number> {
    const rows = await dbClient
      .select()
      .from(schema.userAiApiKeys)
      .where(eq(schema.userAiApiKeys.userId, userId));
    return rows.length;
  }

  async checkDuplicate(
    userId: string,
    keyFingerprint: string,
    dbClient: DbClient = db
  ): Promise<boolean> {
    const rows = await dbClient
      .select()
      .from(schema.userAiApiKeys)
      .where(
        and(
          eq(schema.userAiApiKeys.userId, userId),
          eq(schema.userAiApiKeys.keyFingerprint, keyFingerprint)
        )
      );
    return rows.length > 0;
  }
}
