import { type DbClient } from "@/db";
import { DrizzleApiKeyRepository } from "./infrastructure/db/legacy-api-key-repository";
import {
  createApiRotationPool,
  type ApiRotationPool,
} from "./infrastructure/llm/api-rotation-pool";
import { createGeminiLlmProvider } from "./infrastructure/llm/gemini-llm-provider";

import { DrizzleUserApiKeyRepository } from "./infrastructure/db/drizzle-user-api-key-repo";
import { DrizzleUsageRepository } from "./infrastructure/db/drizzle-usage-repo";

import { createAddUserApiKeyUseCase } from "./application/use-cases/add-user-api-key";
import { createDeleteUserApiKeyUseCase } from "./application/use-cases/delete-user-api-key";
import { createDisableUserApiKeyUseCase } from "./application/use-cases/disable-user-api-key";
import { createEnableUserApiKeyUseCase } from "./application/use-cases/enable-user-api-key";
import { createReverifyUserApiKeyUseCase } from "./application/use-cases/reverify-user-api-key";
import { createGetUserUsageStatsUseCase } from "./application/use-cases/get-user-usage-stats";

import type { ApiKeyRepository } from "./application/ports/api-key-repository";
import type { LlmProvider } from "./application/ports/llm-provider";
import type { AddUserApiKeyInput, UsageTimeframe } from "./domain/types";

// Combined ApiKeyRepository object for rotation pool
const apiKeyRepo = new DrizzleApiKeyRepository();

export function getApiKeyRepository(): ApiKeyRepository {
  return apiKeyRepo;
}

export const getApiKeyRotationPool = (() => {
  let pool: ApiRotationPool | null = null;
  return () => {
    if (!pool) {
      pool = createApiRotationPool({ keyRepo: apiKeyRepo });
    }
    return pool;
  };
})();

export const getLlmProvider = (() => {
  let provider: LlmProvider | null = null;
  return () => {
    if (!provider) {
      provider = createGeminiLlmProvider({
        keyRepo: getApiKeyRepository(),
        apiRotationPool: getApiKeyRotationPool(),
      });
    }
    return provider;
  };
})();

/**
 * @deprecated Use getLlmProvider instead
 */
export function getLLMProvider(): LlmProvider {
  return getLlmProvider();
}

// Instantiate Drizzle Adapters
const drizzleUserApiKeyRepo = new DrizzleUserApiKeyRepository();
const drizzleUsageRepo = new DrizzleUsageRepository();

// Instantiate Use Cases
const addUserApiKeyUC = createAddUserApiKeyUseCase(drizzleUserApiKeyRepo);
const deleteUserApiKeyUC = createDeleteUserApiKeyUseCase(drizzleUserApiKeyRepo);
const disableUserApiKeyUC = createDisableUserApiKeyUseCase(
  drizzleUserApiKeyRepo
);
const enableUserApiKeyUC = createEnableUserApiKeyUseCase(drizzleUserApiKeyRepo);
const reverifyUserApiKeyUC = createReverifyUserApiKeyUseCase(
  drizzleUserApiKeyRepo
);
const getUserUsageStatsUC = createGetUserUsageStatsUseCase(drizzleUsageRepo);

// Factory facade for backward-compatible User API Key Repository
export function getUserApiKeyRepository() {
  return {
    add: (userId: string, data: AddUserApiKeyInput, dbClient?: DbClient) =>
      addUserApiKeyUC.execute(userId, data, dbClient),
    delete: (userId: string, id: string, dbClient?: DbClient) =>
      deleteUserApiKeyUC.execute(userId, id, dbClient),
    disable: (userId: string, id: string, dbClient?: DbClient) =>
      disableUserApiKeyUC.execute(userId, id, dbClient),
    enable: (userId: string, id: string, dbClient?: DbClient) =>
      enableUserApiKeyUC.execute(userId, id, dbClient),
    reverify: (userId: string, id: string, dbClient?: DbClient) =>
      reverifyUserApiKeyUC.execute(userId, id, dbClient),
    findById: (userId: string, id: string, dbClient?: DbClient) =>
      drizzleUserApiKeyRepo.findById(userId, id, dbClient),
    countForUser: (userId: string, dbClient?: DbClient) =>
      drizzleUserApiKeyRepo.countForUser(userId, dbClient),
    checkDuplicate: (
      userId: string,
      fingerprint: string,
      dbClient?: DbClient
    ) => drizzleUserApiKeyRepo.checkDuplicate(userId, fingerprint, dbClient),
  };
}

// Factory facade for backward-compatible Usage Repository
export function getUsageRepository() {
  return {
    getUserUsageStats: (
      userId: string,
      timeframe: UsageTimeframe,
      dbClient?: DbClient
    ) => getUserUsageStatsUC.execute(userId, timeframe, dbClient),
  };
}

// Standalone Use Cases Exports as functions
export const addUserApiKeyUseCase = (
  userId: string,
  data: AddUserApiKeyInput,
  dbClient?: DbClient
) => addUserApiKeyUC.execute(userId, data, dbClient);

export const deleteUserApiKeyUseCase = (
  userId: string,
  id: string,
  dbClient?: DbClient
) => deleteUserApiKeyUC.execute(userId, id, dbClient);

export const disableUserApiKeyUseCase = (
  userId: string,
  id: string,
  dbClient?: DbClient
) => disableUserApiKeyUC.execute(userId, id, dbClient);

export const enableUserApiKeyUseCase = (
  userId: string,
  id: string,
  dbClient?: DbClient
) => enableUserApiKeyUC.execute(userId, id, dbClient);

export const reverifyUserApiKeyUseCase = (
  userId: string,
  id: string,
  dbClient?: DbClient
) => reverifyUserApiKeyUC.execute(userId, id, dbClient);

export const getUserUsageStatsUseCase = (
  userId: string,
  timeframe: UsageTimeframe,
  dbClient?: DbClient
) => getUserUsageStatsUC.execute(userId, timeframe, dbClient);

// Exports for types and ports
export type { UsageStats, UsageTimeframe, UserApiKey } from "./domain/types";
export { MAX_USER_KEYS } from "./application/use-cases/add-user-api-key";
export type { ApiKeyRepository } from "./application/ports/api-key-repository";
export type {
  LlmProvider,
  LLMProvider,
} from "./application/ports/llm-provider";
export type { Prompt } from "./application/ports/prompt";
export type { AiRequestRecorder } from "./application/ports/ai-request-recorder";
