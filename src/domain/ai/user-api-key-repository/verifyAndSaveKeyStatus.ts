import { eq } from "drizzle-orm";
import { schema, type DbClient } from "@/db";
import { decryptApiKey } from "@/lib/crypto";
import { verifyGeminiApiKey } from "../adapters/geminiUtils";

import { type ActionResult } from "@/domain/types";

export async function verifyAndSaveKeyStatus(
  keyRow: typeof schema.userAiApiKeys.$inferSelect,
  requireSuccess: boolean,
  dbClient: DbClient
): Promise<ActionResult> {
  const rawKey = decryptApiKey(keyRow.encryptedKey);
  const verifyError = await verifyGeminiApiKey(rawKey);

  await dbClient
    .update(schema.userAiApiKeys)
    .set({
      status: verifyError ? "invalid" : "active",
      errorMessage: verifyError,
      rateLimitedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.userAiApiKeys.id, keyRow.id));

  if (verifyError) {
    return {
      success: false,
      error: requireSuccess
        ? `Không thể kích hoạt. Xác thực API Key thất bại: ${verifyError}`
        : `Xác thực API Key thất bại: ${verifyError}`,
    };
  }

  return { success: true };
}
