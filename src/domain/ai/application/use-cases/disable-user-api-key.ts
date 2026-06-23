import type { UserApiKeyRepository } from "../ports/user-api-key-repository";
import type { ActionResult } from "@/domain/types";

export interface DisableUserApiKeyUseCase {
  execute(userId: string, id: string): Promise<ActionResult>;
}

export class DisableUserApiKeyService implements DisableUserApiKeyUseCase {
  constructor(private readonly repo: UserApiKeyRepository) {}

  async execute(userId: string, id: string): Promise<ActionResult> {
    const existing = await this.repo.findById(userId, id);
    if (!existing) {
      return {
        success: false,
        error: "Không tìm thấy API Key hoặc không có quyền.",
      };
    }

    await this.repo.updateStatus(id, "disabled", null);
    return { success: true };
  }
}
