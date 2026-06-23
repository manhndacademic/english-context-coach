import { eq } from "drizzle-orm";
import { db, schema, type DbClient } from "@/db";

export async function getUserKeys(userId: string, dbClient: DbClient = db) {
  return await dbClient
    .select({
      id: schema.userAiApiKeys.id,
      encryptedKey: schema.userAiApiKeys.encryptedKey,
      status: schema.userAiApiKeys.status,
      rateLimitedAt: schema.userAiApiKeys.rateLimitedAt,
    })
    .from(schema.userAiApiKeys)
    .where(eq(schema.userAiApiKeys.userId, userId));
}
