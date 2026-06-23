import { eq } from "drizzle-orm";
import { db, schema, type DbClient } from "@/db";

export async function saveUserApiKey(
  userId: string,
  encryptedApiKey: string | null,
  dbClient: DbClient = db
): Promise<void> {
  await dbClient
    .update(schema.users)
    .set({
      customGeminiApiKey: encryptedApiKey,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId));
}
