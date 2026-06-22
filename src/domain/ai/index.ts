import { GeminiLLMProvider } from "./adapters/gemini-provider";
import { DrizzleApiKeyRepository } from "./adapters/api-key-repository";
import { ApiRotationPool } from "./adapters/api-rotation-pool";
import {
  DrizzleUserApiKeyRepository,
  type UserApiKeyRepository,
} from "./user-api-key-repository";
import {
  DrizzleUsageRepository,
  type UsageRepository,
} from "./usage-repository";
import type { LLMProvider, ApiKeyRepository } from "./ports";

let cachedProvider: LLMProvider | null = null;
let cachedKeyRepository: ApiKeyRepository | null = null;
let cachedPool: ApiRotationPool | null = null;
let cachedUserApiKeyRepository: UserApiKeyRepository | null = null;
let cachedUsageRepository: UsageRepository | null = null;

export function getApiKeyRepository(): ApiKeyRepository {
  if (!cachedKeyRepository) {
    cachedKeyRepository = new DrizzleApiKeyRepository();
  }
  return cachedKeyRepository;
}

export function getApiKeyRotationPool(): ApiRotationPool {
  if (!cachedPool) {
    cachedPool = new ApiRotationPool(getApiKeyRepository());
  }
  return cachedPool;
}

export function getLLMProvider(): LLMProvider {
  if (!cachedProvider) {
    cachedProvider = new GeminiLLMProvider(
      getApiKeyRepository(),
      undefined,
      getApiKeyRotationPool()
    );
  }
  return cachedProvider;
}

export function getUserApiKeyRepository(): UserApiKeyRepository {
  if (!cachedUserApiKeyRepository) {
    cachedUserApiKeyRepository = new DrizzleUserApiKeyRepository();
  }
  return cachedUserApiKeyRepository;
}

export function getUsageRepository(): UsageRepository {
  if (!cachedUsageRepository) {
    cachedUsageRepository = new DrizzleUsageRepository();
  }
  return cachedUsageRepository;
}

export type { LLMProvider, ApiKeyRepository, Prompt } from "./ports";
export type { UserApiKeyRepository } from "./user-api-key-repository";
export {
  DrizzleUserApiKeyRepository,
  MAX_USER_KEYS,
} from "./user-api-key-repository";
export type {
  UsageRepository,
  UsageStats,
  UsageTimeframe,
} from "./usage-repository";
export { DrizzleUsageRepository } from "./usage-repository";
