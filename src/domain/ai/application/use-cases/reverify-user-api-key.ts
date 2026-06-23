import type { UserApiKeyRepository } from "../ports/user-api-key-repository";
import type { ApiKeyVerifier } from "../ports/api-key-verifier";
import type { ActionResult } from "@/domain/types";
import { decryptApiKey } from "@/lib/crypto";

export interface ReverifyUserApiKeyUseCase {
  execute(userId: string, id: string): Promise<ActionResult>;
}

export class ReverifyUserApiKeyService implements ReverifyUserApiKeyUseCase {
  constructor(
    private readonly repo: UserApiKeyRepository,
    private readonly verifier: ApiKeyVerifier
  ) {}

  async execute(userId: string, id: string): Promise<ActionResult> {
    const keyRow = await this.repo.findById(userId, id);
    if (!keyRow) {
      return {
        success: false,
        error: "Không tìm thấy API Key hoặc không có quyền.",
      };
    }

    const rawKey = decryptApiKey(keyRow.encryptedKey);
    const verifyError = await this.verifier.verify(rawKey);

    const status = verifyError ? "invalid" : "active";
    await this.repo.updateStatus(id, status, verifyError);

    if (verifyError) {
      return {
        success: false,
        error: `Xác thực API Key thất bại: ${verifyError}`,
      };
    }

    return { success: true };
  }
}
