import { type DbClient } from "@/db";
import { sha256 } from "@/lib/crypto";
import { verifyGeminiApiKey } from "../adapters/geminiUtils";
import type { AddUserApiKeyInput } from "../types";
import { MAX_USER_KEYS } from "./constants";
import { countUserKeys } from "./countUserKeys";
import { checkUserKeyDuplicate } from "./checkUserKeyDuplicate";

export async function validateAddKey(
  userId: string,
  data: AddUserApiKeyInput,
  dbClient: DbClient
): Promise<
  { success: true; fingerprint: string } | { success: false; error: string }
> {
  const existingCount = await countUserKeys(userId, dbClient);
  if (existingCount >= MAX_USER_KEYS) {
    return {
      success: false,
      error: `Bạn chỉ có thể lưu tối đa ${MAX_USER_KEYS} API keys.`,
    };
  }

  const fingerprint = sha256(`${data.provider}:${data.apiKey}`);
  const duplicate = await checkUserKeyDuplicate(userId, fingerprint, dbClient);
  if (duplicate) {
    return { success: false, error: "Key này đã tồn tại." };
  }

  const verifyError = await verifyGeminiApiKey(data.apiKey);
  if (verifyError) {
    return {
      success: false,
      error: `Xác thực API Key thất bại: ${verifyError}`,
    };
  }

  return { success: true, fingerprint };
}
