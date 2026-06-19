import { GeminiLLMProvider } from "./adapters/gemini-provider";
import { DrizzleKeyResolver } from "./adapters/key-resolver";
import {
  DrizzleUserApiKeyRepository,
  type UserApiKeyRepository,
} from "./user-api-key-repository";
import {
  DrizzleUsageRepository,
  type UsageRepository,
} from "./usage-repository";
import type { LLMProvider, KeyResolver } from "./ports";

let cachedProvider: LLMProvider | null = null;
let cachedKeyResolver: KeyResolver | null = null;
let cachedUserApiKeyRepository: UserApiKeyRepository | null = null;
let cachedUsageRepository: UsageRepository | null = null;

export function getLLMProvider(): LLMProvider {
  if (!cachedProvider) {
    cachedProvider = new GeminiLLMProvider();
  }
  return cachedProvider;
}

export function getKeyResolver(): KeyResolver {
  if (!cachedKeyResolver) {
    cachedKeyResolver = new DrizzleKeyResolver();
  }
  return cachedKeyResolver;
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

export type { LLMProvider, KeyResolver, Prompt } from "./ports";
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
