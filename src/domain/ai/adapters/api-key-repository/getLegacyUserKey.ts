import { eq } from "drizzle-orm";
import { db, schema, type DbClient } from "@/db";

export async function getLegacyUserKey(
  userId: string,
  dbClient: DbClient = db
): Promise<string | null> {
  const [user] = await dbClient
    .select({ customGeminiApiKey: schema.users.customGeminiApiKey })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return user?.customGeminiApiKey ?? null;
}
