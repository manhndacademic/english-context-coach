import { and, eq } from "drizzle-orm";
import { db, schema, type DbClient } from "@/db";

import { type ActionResult } from "@/domain/types";

export async function disableUserApiKey(
  userId: string,
  keyId: string,
  dbClient: DbClient = db
): Promise<ActionResult> {
  const updated = await dbClient
    .update(schema.userAiApiKeys)
    .set({ status: "disabled", updatedAt: new Date() })
    .where(
      and(
        eq(schema.userAiApiKeys.id, keyId),
        eq(schema.userAiApiKeys.userId, userId)
      )
    )
    .returning({ id: schema.userAiApiKeys.id });

  if (updated.length === 0) {
    return {
      success: false,
      error: "Không tìm thấy API Key hoặc không có quyền.",
    };
  }

  return { success: true };
}
