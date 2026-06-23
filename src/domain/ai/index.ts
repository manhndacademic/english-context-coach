import { getSystemKeys } from "./adapters/api-key-repository/getSystemKeys";
import { getUserKeys } from "./adapters/api-key-repository/getUserKeys";
import { getLegacyUserKey } from "./adapters/api-key-repository/getLegacyUserKey";
import { updateKeyStatus } from "./adapters/api-key-repository/updateKeyStatus";
import { saveUserApiKey } from "./adapters/api-key-repository/saveUserApiKey";

import { addUserApiKey } from "./user-api-key-repository/addUserApiKey";
import { deleteUserApiKey } from "./user-api-key-repository/deleteUserApiKey";
import { disableUserApiKey } from "./user-api-key-repository/disableUserApiKey";
import { enableUserApiKey } from "./user-api-key-repository/enableUserApiKey";
import { reverifyUserApiKey } from "./user-api-key-repository/reverifyUserApiKey";
import { findUserApiKeyById } from "./user-api-key-repository/findUserApiKeyById";
import { countUserKeys } from "./user-api-key-repository/countUserKeys";
import { checkUserKeyDuplicate } from "./user-api-key-repository/checkUserKeyDuplicate";

import { getUserUsageStats } from "./usage-repository/getUserUsageStats";

import {
  createApiRotationPool,
  type ApiRotationPool,
} from "./adapters/ApiRotationPool";
import { createGeminiLlmProvider } from "./adapters/GeminiLlmProvider";

import type { LlmProvider, ApiKeyRepository } from "./ports";

// Combined ApiKeyRepository object
const apiKeyRepo: ApiKeyRepository = {
  getSystemKeys,
  getUserKeys,
  getLegacyUserKey,
  updateKeyStatus,
  saveUserApiKey,
};

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

// User API Key Repository functions wrapped into a backward-compatible interface object
export interface UserApiKeyRepository {
  add: typeof addUserApiKey;
  delete: typeof deleteUserApiKey;
  disable: typeof disableUserApiKey;
  enable: typeof enableUserApiKey;
  reverify: typeof reverifyUserApiKey;
  findById: typeof findUserApiKeyById;
  countForUser: typeof countUserKeys;
  checkDuplicate: typeof checkUserKeyDuplicate;
}

export function getUserApiKeyRepository(): UserApiKeyRepository {
  return {
    add: addUserApiKey,
    delete: deleteUserApiKey,
    disable: disableUserApiKey,
    enable: enableUserApiKey,
    reverify: reverifyUserApiKey,
    findById: findUserApiKeyById,
    countForUser: countUserKeys,
    checkDuplicate: checkUserKeyDuplicate,
  };
}

// Usage Repository functions wrapped into a backward-compatible interface object
export interface UsageRepository {
  getUserUsageStats: typeof getUserUsageStats;
}

export function getUsageRepository(): UsageRepository {
  return {
    getUserUsageStats,
  };
}

export type {
  LlmProvider,
  LLMProvider,
  ApiKeyRepository,
  Prompt,
} from "./ports";
export { MAX_USER_KEYS } from "./user-api-key-repository/constants";
export type {
  UsageStats,
  UsageTimeframe,
} from "./usage-repository/getUserUsageStats";
