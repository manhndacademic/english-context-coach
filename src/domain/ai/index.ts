import { AddUserApiKeyService } from "./application/use-cases/add-user-api-key";
import { DeleteUserApiKeyService } from "./application/use-cases/delete-user-api-key";
import { DisableUserApiKeyService } from "./application/use-cases/disable-user-api-key";
import { EnableUserApiKeyService } from "./application/use-cases/enable-user-api-key";
import { GetUserUsageStatsService } from "./application/use-cases/get-user-usage-stats";
import { ReverifyUserApiKeyService } from "./application/use-cases/reverify-user-api-key";
import { DrizzleUsageRepository } from "./infrastructure/db/drizzle-usage-repository";
import { DrizzleUserApiKeyRepository } from "./infrastructure/db/drizzle-user-api-key-repository";
import { DrizzleApiKeyRepository } from "./infrastructure/db/legacy-api-key-repository";
import { createApiRotationPool } from "./infrastructure/llm/api-rotation-pool";
import { createGeminiLlmProvider } from "./infrastructure/llm/gemini-llm-provider";
import { verifyGeminiApiKey } from "./infrastructure/llm/gemini-utils";
import type { ApiKeyVerifier } from "./application/ports/api-key-verifier";

// Named singleton exports for repositories and infrastructure services
export const apiKeyRepository = new DrizzleApiKeyRepository();

export const apiKeyRotationPool = createApiRotationPool({
  keyRepo: apiKeyRepository,
});

export const llmProvider = createGeminiLlmProvider({
  keyRepo: apiKeyRepository,
  apiRotationPool: apiKeyRotationPool,
});

export const userApiKeyRepository = new DrizzleUserApiKeyRepository();
export const usageRepository = new DrizzleUsageRepository();

// Concrete ApiKeyVerifier adapter backed by the Gemini SDK
const geminiKeyVerifier: ApiKeyVerifier = {
  verify: verifyGeminiApiKey,
};

// Unified Use Case Factory Object
export const aiUseCases = {
  addUserApiKey() {
    return new AddUserApiKeyService(userApiKeyRepository, geminiKeyVerifier);
  },
  deleteUserApiKey() {
    return new DeleteUserApiKeyService(userApiKeyRepository);
  },
  disableUserApiKey() {
    return new DisableUserApiKeyService(userApiKeyRepository);
  },
  enableUserApiKey() {
    return new EnableUserApiKeyService(userApiKeyRepository, geminiKeyVerifier);
  },
  reverifyUserApiKey() {
    return new ReverifyUserApiKeyService(
      userApiKeyRepository,
      geminiKeyVerifier
    );
  },
  getUserUsageStats() {
    return new GetUserUsageStatsService(usageRepository);
  },
};

// Exports for types and ports
export type { AiRequestRecorder } from "./application/ports/ai-request-recorder";
export type { ApiKeyRepository } from "./application/ports/api-key-repository";
export type { ApiKeyVerifier } from "./application/ports/api-key-verifier";
export type {
  LlmProvider,
  LlmProvider as LLMProvider,
} from "./application/ports/llm-provider";
export type { Prompt } from "./application/ports/prompt";
export { MAX_USER_KEYS } from "./application/use-cases/add-user-api-key";
export type { UsageStats, UsageTimeframe, UserApiKey } from "./domain/types";
