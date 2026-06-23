import { and, eq } from "drizzle-orm";
import { db, schema, type DbClient } from "@/db";

export async function checkUserKeyDuplicate(
  userId: string,
  fingerprint: string,
  dbClient: DbClient = db
): Promise<boolean> {
  const [duplicate] = await dbClient
    .select({ id: schema.userAiApiKeys.id })
    .from(schema.userAiApiKeys)
    .where(
      and(
        eq(schema.userAiApiKeys.userId, userId),
        eq(schema.userAiApiKeys.keyFingerprint, fingerprint)
      )
    )
    .limit(1);

  return Boolean(duplicate);
}
