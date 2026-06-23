import type { UserApiKeyRepository } from "../ports/user-api-key-repository";
import type { ActionResult } from "@/domain/types";
import { decryptApiKey } from "@/lib/crypto";
import { verifyGeminiApiKey } from "../../infrastructure/llm/gemini-utils";
import type { DbClient } from "@/db";

export interface EnableUserApiKeyUseCase {
  execute(
    userId: string,
    id: string,
    dbClient?: DbClient
  ): Promise<ActionResult>;
}

export class EnableUserApiKeyService implements EnableUserApiKeyUseCase {
  constructor(private readonly repo: UserApiKeyRepository) {}

  async execute(
    userId: string,
    id: string,
    dbClient?: DbClient
  ): Promise<ActionResult> {
    const keyRow = await this.repo.findById(userId, id, dbClient);
    if (!keyRow) {
      return {
        success: false,
        error: "Không tìm thấy API Key hoặc không có quyền.",
      };
    }

    const rawKey = decryptApiKey(keyRow.encryptedKey);
    const verifyError = await verifyGeminiApiKey(rawKey);

    const status = verifyError ? "invalid" : "active";
    await this.repo.updateStatus(id, status, verifyError, dbClient);

    if (verifyError) {
      return {
        success: false,
        error: `Không thể kích hoạt. Xác thực API Key thất bại: ${verifyError}`,
      };
    }

    return { success: true };
  }
}

export function createEnableUserApiKeyUseCase(
  repo: UserApiKeyRepository
): EnableUserApiKeyUseCase {
  return new EnableUserApiKeyService(repo);
}
