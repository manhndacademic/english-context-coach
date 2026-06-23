import { db, type DbClient } from "@/db";
import { type ActionResult } from "@/domain/types";
import { findUserApiKeyById } from "./findUserApiKeyById";
import { verifyAndSaveKeyStatus } from "./verifyAndSaveKeyStatus";

export async function enableUserApiKey(
  userId: string,
  keyId: string,
  dbClient: DbClient = db
): Promise<ActionResult> {
  const keyRow = await findUserApiKeyById(userId, keyId, dbClient);
  if (!keyRow) {
    return {
      success: false,
      error: "Không tìm thấy API Key hoặc không có quyền.",
    };
  }
  return verifyAndSaveKeyStatus(keyRow, true, dbClient);
}
