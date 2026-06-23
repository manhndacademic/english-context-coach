import type { UserApiKeyRepository } from "../ports/user-api-key-repository";
import type { ActionResult } from "@/domain/types";
import type { DbClient } from "@/db";

export interface DisableUserApiKeyUseCase {
  execute(
    userId: string,
    id: string,
    dbClient?: DbClient
  ): Promise<ActionResult>;
}

export class DisableUserApiKeyService implements DisableUserApiKeyUseCase {
  constructor(private readonly repo: UserApiKeyRepository) {}

  async execute(
    userId: string,
    id: string,
    dbClient?: DbClient
  ): Promise<ActionResult> {
    const existing = await this.repo.findById(userId, id, dbClient);
    if (!existing) {
      return {
        success: false,
        error: "Không tìm thấy API Key hoặc không có quyền.",
      };
    }

    await this.repo.updateStatus(id, "disabled", null, dbClient);
    return { success: true };
  }
}

export function createDisableUserApiKeyUseCase(
  repo: UserApiKeyRepository
): DisableUserApiKeyUseCase {
  return new DisableUserApiKeyService(repo);
}
