import type { UserApiKeyRepository } from "../ports/user-api-key-repository";
import type { ActionResult } from "@/domain/types";
import type { DbClient } from "@/db";

export interface DeleteUserApiKeyUseCase {
  execute(
    userId: string,
    id: string,
    dbClient?: DbClient
  ): Promise<ActionResult>;
}

export class DeleteUserApiKeyService implements DeleteUserApiKeyUseCase {
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

    await this.repo.delete(userId, id, dbClient);
    return { success: true };
  }
}

export function createDeleteUserApiKeyUseCase(
  repo: UserApiKeyRepository
): DeleteUserApiKeyUseCase {
  return new DeleteUserApiKeyService(repo);
}
