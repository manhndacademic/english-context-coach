import type { UserApiKeyRepository } from "../ports/user-api-key-repository";
import type { AddUserApiKeyInput } from "../../domain/types";
import type { ActionResult } from "@/domain/types";
import { encryptApiKey, sha256 } from "@/lib/crypto";
import { verifyGeminiApiKey } from "../../infrastructure/llm/gemini-utils";

export const MAX_USER_KEYS = 10;

export interface AddUserApiKeyUseCase {
  execute(userId: string, data: AddUserApiKeyInput): Promise<ActionResult>;
}

export class AddUserApiKeyService implements AddUserApiKeyUseCase {
  constructor(private readonly repo: UserApiKeyRepository) {}

  async execute(
    userId: string,
    data: AddUserApiKeyInput
  ): Promise<ActionResult> {
    const existingCount = await this.repo.countForUser(userId);
    if (existingCount >= MAX_USER_KEYS) {
      return {
        success: false,
        error: `Bạn chỉ có thể lưu tối đa ${MAX_USER_KEYS} API keys.`,
      };
    }

    const fingerprint = sha256(`${data.provider}:${data.apiKey}`);
    const duplicate = await this.repo.checkDuplicate(userId, fingerprint);
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

    const encryptedKey = encryptApiKey(data.apiKey);
    await this.repo.add(userId, data.name, encryptedKey, fingerprint);

    return { success: true };
  }
}
