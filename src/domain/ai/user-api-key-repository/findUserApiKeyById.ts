import { and, eq } from "drizzle-orm";
import { db, schema, type DbClient } from "@/db";

export async function findUserApiKeyById(
  userId: string,
  keyId: string,
  dbClient: DbClient = db
): Promise<typeof schema.userAiApiKeys.$inferSelect | null> {
  const [row] = await dbClient
    .select()
    .from(schema.userAiApiKeys)
    .where(
      and(
        eq(schema.userAiApiKeys.id, keyId),
        eq(schema.userAiApiKeys.userId, userId)
      )
    )
    .limit(1);

  return row ?? null;
}
