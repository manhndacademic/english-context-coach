import { ThinkingLevel } from "@google/genai";
import { addMilliseconds, addMinutes, isAfter, isBefore } from "date-fns";
import { getLogger } from "@/lib/logger";
import { isRateLimitError, isInvalidKeyError, AiError } from "./geminiUtils";
import type { AiModelKind } from "@/domain/types";
import {
  LlmValidationError,
  type ModelCooldown,
  DEFAULT_ANALYSIS_MODELS,
  DEFAULT_FAST_MODELS,
  GEMMA_MODELS,
  GEMMA_UNSUPPORTED_THINKING,
  parseModelList,
  parseApiKeys,
} from "./helpers/apiPoolTypes";
import { resolveApiKey } from "./helpers/api-key-resolver/resolveApiKey";
import { getSystemKeys } from "./api-key-repository/getSystemKeys";
import { getUserKeys } from "./api-key-repository/getUserKeys";
import { getLegacyUserKey } from "./api-key-repository/getLegacyUserKey";
import { updateKeyStatus } from "./api-key-repository/updateKeyStatus";
import { saveUserApiKey } from "./api-key-repository/saveUserApiKey";
import type {
  ApiRotationPoolOptions,
  RotationOptions,
  RotationResult,
  ModelRotationOptions,
} from "../types";

const apiKeyRepo = {
  getSystemKeys,
  getUserKeys,
  getLegacyUserKey,
  updateKeyStatus,
  saveUserApiKey,
};

const logger = getLogger("d.m.ai.ApiRotationPool", "ai-provider");

export {
  parseApiKeys,
  LlmValidationError,
  type ModelCooldown,
} from "./helpers/apiPoolTypes";

export function createApiRotationPool(options: ApiRotationPoolOptions = {}) {
  const repo = options.keyRepo ?? apiKeyRepo;
  const analysisModels =
    options.analysisModels ??
    parseModelList(process.env.GEMINI_ANALYSIS_MODELS, DEFAULT_ANALYSIS_MODELS);
  const fastModels =
    options.fastModels ??
    parseModelList(process.env.GEMINI_FAST_MODELS, DEFAULT_FAST_MODELS);

  const modelCooldowns = new Map<string, number>();
  const envKeyCooldowns = new Map<string, number>();
  const envKeyInvalid = new Set<string>();
  const keyModelCooldowns = new Map<string, number>();

  function getCooldownMs(): number {
    const envVal = process.env.GEMINI_COOLDOWN_MS;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
    return 30_000;
  }

  function getModels(kind: AiModelKind): string[] {
    return kind === "analysis" ? analysisModels : fastModels;
  }

  function getNextAvailable(
    kind: AiModelKind,
    excluded?: Set<string>,
    hasSchema?: boolean
  ): string {
    const now = new Date();
    const allModels = getModels(kind);
    const hasGeminiModels = allModels.some((model) =>
      model.toLowerCase().startsWith("gemini-")
    );
    const pool =
      hasSchema && hasGeminiModels
        ? allModels.filter((model) => model.toLowerCase().startsWith("gemini-"))
        : allModels;

    for (const model of pool) {
      if (excluded?.has(model)) continue;
      const cooldownUntil = modelCooldowns.get(model) ?? 0;
      if (!isBefore(now, cooldownUntil)) {
        return model;
      }
    }

    const firstAvailable = pool.find((m) => !excluded?.has(m));
    if (firstAvailable) return firstAvailable;
    return pool[0];
  }

  function markRateLimited(model: string): void {
    const cooldownMs = getCooldownMs();
    const until = addMilliseconds(new Date(), cooldownMs).getTime();
    modelCooldowns.set(model, until);
    logger.warn(
      `[ApiRotationPool] Model "${model}" rate-limited. Cooling down for ${cooldownMs / 1000}s until ${new Date(until).toISOString()}.`
    );
  }

  function clearCooldown(model: string): void {
    if (modelCooldowns.has(model)) {
      modelCooldowns.delete(model);
    }
  }

  function isAvailable(model: string): boolean {
    const until = modelCooldowns.get(model) ?? 0;
    return !isBefore(new Date(), until);
  }

  function getThinkingLevel(
    model: string,
    requestedLevel: ThinkingLevel
  ): ThinkingLevel {
    if (GEMMA_MODELS.has(model)) {
      const levelKey = Object.keys(ThinkingLevel).find(
        (k) => ThinkingLevel[k as keyof typeof ThinkingLevel] === requestedLevel
      );
      if (levelKey && GEMMA_UNSUPPORTED_THINKING.has(levelKey)) {
        return ThinkingLevel.MINIMAL;
      }
    }
    return requestedLevel;
  }

  function getCooldowns(): ModelCooldown[] {
    const now = new Date();
    const result: ModelCooldown[] = [];
    for (const [model, cooldownUntil] of modelCooldowns.entries()) {
      if (isAfter(cooldownUntil, now)) {
        result.push({ model, cooldownUntil });
      }
    }
    return result;
  }

  function clearCooldowns(): void {
    modelCooldowns.clear();
    envKeyCooldowns.clear();
    envKeyInvalid.clear();
    keyModelCooldowns.clear();
  }

  function isKeyModelCooldown(keyId: string, model: string): boolean {
    const cacheKey = `${keyId}:${model}`;
    const cooldownUntil = keyModelCooldowns.get(cacheKey) ?? 0;
    return isBefore(new Date(), cooldownUntil);
  }

  function getEnvKeysStatus(): {
    active: number;
    rateLimited: number;
    invalid: number;
    total: number;
  } {
    let envKeys: string[] = [];
    if (process.env.GEMINI_API_KEYS) {
      envKeys = parseApiKeys(process.env.GEMINI_API_KEYS);
    }
    if (envKeys.length === 0 && process.env.GEMINI_API_KEY) {
      envKeys = parseApiKeys(process.env.GEMINI_API_KEY);
    }

    const now = new Date();
    let active = 0;
    let rateLimited = 0;
    let invalid = 0;

    for (let index = 0; index < envKeys.length; index++) {
      const keyId = `env-key-${index}`;
      if (envKeyInvalid.has(keyId)) {
        invalid++;
      } else {
        const cooldownUntil = envKeyCooldowns.get(keyId) ?? 0;
        if (isBefore(now, cooldownUntil)) {
          rateLimited++;
        } else {
          active++;
        }
      }
    }

    return {
      active,
      rateLimited,
      invalid,
      total: envKeys.length,
    };
  }

  async function executeWithRotation<T>(
    options: RotationOptions<T>
  ): Promise<RotationResult<T>> {
    const allModels = getModels(options.modelKind);
    const hasGeminiModels = allModels.some((model) =>
      model.toLowerCase().startsWith("gemini-")
    );
    const models =
      options.hasSchema && hasGeminiModels
        ? allModels.filter((model) => model.toLowerCase().startsWith("gemini-"))
        : allModels;
    const exhaustedModels = new Set<string>();
    let resolvedModel = getNextAvailable(
      options.modelKind,
      undefined,
      options.hasSchema
    );

    const attempt = async (
      modelIdx: number
    ): Promise<{ result: T; resolvedModel: string }> => {
      if (modelIdx >= models.length) {
        throw new AiError(
          `All models in the ${options.modelKind} pool are rate-limited or unavailable.`,
          "all_models_failed"
        );
      }

      const model = getNextAvailable(
        options.modelKind,
        exhaustedModels,
        options.hasSchema
      );
      exhaustedModels.add(model);
      resolvedModel = model;

      try {
        const result = await executeWithModelRotation(model, options);
        clearCooldown(model);
        return { result, resolvedModel };
      } catch (err: any) {
        const isRateLimit =
          isRateLimitError(err) ||
          err.code === "all_keys_failed" ||
          err.message?.includes("keys available");

        if (isRateLimit && modelIdx < models.length - 1) {
          markRateLimited(model);
          return attempt(modelIdx + 1);
        }
        throw err;
      }
    };

    return attempt(0);
  }

  async function executeWithModelRotation<T>(
    model: string,
    options: ModelRotationOptions<T>
  ): Promise<T> {
    const excludedKeyIds = new Set<string>();
    let attempts = 0;
    const maxKeyAttempts = 5;

    while (attempts < maxKeyAttempts) {
      attempts++;
      logger.debug(
        `[ApiRotationPool] Attempt ${attempts}: resolving key for model ${model} with exclusions: [${Array.from(
          excludedKeyIds
        ).join(", ")}]`
      );

      const resolved = await resolveApiKey({
        keyRepo: repo,
        userId: options.userId,
        excludedKeyIds,
        model,
        isKeyModelCooldown: (keyId, m) => isKeyModelCooldown(keyId, m),
        isEnvKeyInvalid: (keyId) => envKeyInvalid.has(keyId),
        isEnvKeyCooldown: (keyId) => {
          const cooldownUntil = envKeyCooldowns.get(keyId) ?? 0;
          return Date.now() < cooldownUntil;
        },
      });
      const { key, id: keyId, isUserKey } = resolved;

      logger.debug(
        `[ApiRotationPool] Resolved key ID ${keyId || "env_key"} (${
          isUserKey ? "user" : "system"
        }), masked: ${key.slice(0, 4)}...`
      );

      try {
        const result = await options.execute({ key, model, keyId, isUserKey });

        if (keyId && !isUserKey) {
          await restoreKeyToActive(keyId);
        }

        return result;
      } catch (err: any) {
        await handleModelRotationError({
          err,
          keyId,
          isUserKey,
          model,
          attempts,
          maxKeyAttempts,
          excludedKeyIds,
        });
      }
    }

    throw new AiError("AI provider error: request failed.", "unknown");
  }

  async function handleModelRotationError(options: {
    err: any;
    keyId: string | undefined;
    isUserKey: boolean;
    model: string;
    attempts: number;
    maxKeyAttempts: number;
    excludedKeyIds: Set<string>;
  }): Promise<boolean> {
    const {
      err,
      keyId,
      isUserKey,
      model,
      attempts,
      maxKeyAttempts,
      excludedKeyIds,
    } = options;
    let apiCallFailed = false;

    if (err instanceof LlmValidationError) {
      logger.warn(
        `[ApiRotationPool] Gemini API call succeeded but validation failed on key ID ${
          keyId || "env_key"
        }. Error: ${err.message}. Key is kept active.`
      );
    } else {
      apiCallFailed = true;
    }

    if (keyId && apiCallFailed) {
      excludedKeyIds.add(keyId);
      if (!isUserKey) {
        if (isRateLimitError(err)) {
          logger.warn(
            `[ApiRotationPool] Marking key ID ${keyId} rate-limited: ${err.message || err}`
          );
          await markKeyRateLimited(
            keyId,
            err.message || "Rate limit exceeded",
            model
          );
        } else if (isInvalidKeyError(err)) {
          logger.error(
            `[ApiRotationPool] Marking key ID ${keyId} invalid: ${err.message || err}`
          );
          await markKeyInvalid(keyId, err.message || "Invalid API key");
        }
      } else {
        logger.warn(
          `User custom API key ${keyId} failed: ${err.message || err}`
        );
      }
    }

    if (attempts >= maxKeyAttempts) {
      throw new AiError(
        isUserKey
          ? `Custom User API Key failed: ${err.message || err}`
          : `All API keys exhausted for model "${model}". Last error: ${err.message || err}`,
        isUserKey ? "user_key_failed" : "all_keys_failed"
      );
    }

    return apiCallFailed;
  }

  async function markKeyRateLimited(
    keyId: string,
    errorMsg: string,
    model?: string
  ): Promise<void> {
    const cooldownUntil = addMinutes(new Date(), 1).getTime();

    if (model) {
      const cacheKey = `${keyId}:${model}`;
      keyModelCooldowns.set(cacheKey, cooldownUntil);
      logger.warn(
        `API key marked rate_limited for model ${model} (in-memory): ${keyId}. Error: ${errorMsg}`
      );
      return;
    }

    if (keyId.startsWith("env-key-")) {
      envKeyCooldowns.set(keyId, cooldownUntil);
      logger.warn(
        `API key marked rate_limited (in-memory): ${keyId}. Error: ${errorMsg}`
      );
      return;
    }

    try {
      await repo.updateKeyStatus(keyId, "rate_limited", errorMsg);
      logger.warn(`API key marked rate_limited: ${keyId}. Error: ${errorMsg}`);
    } catch (e) {
      logger.error(`Failed to update rate_limited status for key ${keyId}:`, e);
    }
  }

  async function markKeyInvalid(
    keyId: string,
    errorMsg: string
  ): Promise<void> {
    if (keyId.startsWith("env-key-")) {
      envKeyInvalid.add(keyId);
      logger.error(
        `API key marked invalid (in-memory): ${keyId}. Error: ${errorMsg}`
      );
      return;
    }
    try {
      await repo.updateKeyStatus(keyId, "invalid", errorMsg);
      logger.error(`API key marked invalid: ${keyId}. Error: ${errorMsg}`);
    } catch (e) {
      logger.error(`Failed to update invalid status for key ${keyId}:`, e);
    }
  }

  async function restoreKeyToActive(keyId: string): Promise<void> {
    if (keyId.startsWith("env-key-")) {
      envKeyCooldowns.delete(keyId);
      logger.info(`Environment API key reset to active (in-memory): ${keyId}`);
      return;
    }
    try {
      await repo.updateKeyStatus(keyId, "active", null);
      logger.info(`API key reset to active: ${keyId}`);
    } catch (e) {
      logger.error(`Failed to restore active status for key ${keyId}:`, e);
    }
  }

  return {
    getModels,
    getNextAvailable,
    markRateLimited,
    clearCooldown,
    isAvailable,
    getThinkingLevel,
    getCooldowns,
    clearCooldowns,
    isKeyModelCooldown,
    getEnvKeysStatus,
    executeWithRotation,
    executeWithModelRotation,
    markKeyRateLimited,
    markKeyInvalid,
    restoreKeyToActive,
  };
}
export type ApiRotationPool = ReturnType<typeof createApiRotationPool>;
