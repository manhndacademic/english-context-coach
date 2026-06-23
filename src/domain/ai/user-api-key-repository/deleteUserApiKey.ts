import { and, eq } from "drizzle-orm";
import { db, schema, type DbClient } from "@/db";

import { type ActionResult } from "@/domain/types";

export async function deleteUserApiKey(
  userId: string,
  keyId: string,
  dbClient: DbClient = db
): Promise<ActionResult> {
  const deleted = await dbClient
    .delete(schema.userAiApiKeys)
    .where(
      and(
        eq(schema.userAiApiKeys.id, keyId),
        eq(schema.userAiApiKeys.userId, userId)
      )
    )
    .returning({ id: schema.userAiApiKeys.id });

  if (deleted.length === 0) {
    return {
      success: false,
      error: "Không tìm thấy API Key hoặc không có quyền.",
    };
  }

  return { success: true };
}
