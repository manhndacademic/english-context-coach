import { eq, count } from "drizzle-orm";
import { db, schema, type DbClient } from "@/db";

export async function countUserKeys(
  userId: string,
  dbClient: DbClient = db
): Promise<number> {
  const [{ value }] = await dbClient
    .select({ value: count() })
    .from(schema.userAiApiKeys)
    .where(eq(schema.userAiApiKeys.userId, userId));

  return value;
}
