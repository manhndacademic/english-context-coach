import { eq } from "drizzle-orm";
import { db, schema, type DbClient } from "@/db";

export async function updateKeyStatus(
  keyId: string,
  status: "active" | "rate_limited" | "invalid",
  errorMessage: string | null,
  dbClient: DbClient = db
): Promise<void> {
  const now = new Date();

  // Try updating user AI keys first
  const updatedUserKeys = await dbClient
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
  await dbClient
    .update(schema.aiApiKeys)
    .set({
      status,
      errorMessage,
      rateLimitedAt: status === "rate_limited" ? now : null,
      updatedAt: now,
    })
    .where(eq(schema.aiApiKeys.id, keyId));
}
