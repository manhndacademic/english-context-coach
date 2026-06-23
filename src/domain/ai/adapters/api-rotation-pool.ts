import { ThinkingLevel } from "@google/genai";
import { getLogger } from "@/lib/logger";
import { decryptApiKey } from "@/lib/crypto";
import type { ApiKeyRepository } from "../ports";
import { DrizzleApiKeyRepository } from "./api-key-repository";
import { isRateLimitError, isInvalidKeyError, AiError } from "./gemini-utils";
import type { AiModelKind, AiPurpose } from "@/domain/types";

const logger = getLogger("d.m.ai.ApiRotationPool", "ai-provider");

const DEFAULT_ANALYSIS_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
];

const DEFAULT_FAST_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
];

const GEMMA_MODELS = new Set(["gemma-4-31b-it", "gemma-4-26b-a4b-it"]);
const GEMMA_UNSUPPORTED_THINKING = new Set<string>(["LOW", "MEDIUM"]);

function parseModelList(env: string | undefined, defaults: string[]): string[] {
  if (!env?.trim()) return defaults;
  const parsed = env.split(",").flatMap((m) => {
    const trimmed = m.trim();
    return trimmed ? [trimmed] : [];
  });
  return parsed.length > 0 ? parsed : defaults;
}

export function parseApiKeys(envKeysStr: string | undefined): string[] {
  if (!envKeysStr) return [];
  const rawParts = envKeysStr.split(/[,\n]+/);
  const keys: string[] = [];
  for (const part of rawParts) {
    let clean = part.split("#")[0].split("//")[0];
    clean = clean.trim();
    if (clean) {
      keys.push(clean);
    }
  }
  return keys;
}

export class LlmValidationError extends Error {
  constructor(
    message: string,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = "LlmValidationError";
  }
}

export interface ModelCooldown {
  model: string;
  cooldownUntil: number;
}

export class ApiRotationPool {
  private readonly analysisModels: string[];
  private readonly fastModels: string[];

  // Instance-level cooldown and invalidation states
  private readonly modelCooldowns = new Map<string, number>();
  private readonly envKeyCooldowns = new Map<string, number>();
  private readonly envKeyInvalid = new Set<string>();
  private readonly keyModelCooldowns = new Map<string, number>();

  constructor(
    private readonly keyRepo: ApiKeyRepository = new DrizzleApiKeyRepository(),
    analysisModels?: string[],
    fastModels?: string[]
  ) {
    this.analysisModels =
      analysisModels ??
      parseModelList(
        process.env.GEMINI_ANALYSIS_MODELS,
        DEFAULT_ANALYSIS_MODELS
      );
    this.fastModels =
      fastModels ??
      parseModelList(process.env.GEMINI_FAST_MODELS, DEFAULT_FAST_MODELS);
  }

  private getCooldownMs(): number {
    const envVal = process.env.GEMINI_COOLDOWN_MS;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
    return 30_000;
  }

  getModels(kind: AiModelKind): string[] {
    return kind === "analysis" ? this.analysisModels : this.fastModels;
  }

  getNextAvailable(
    kind: AiModelKind,
    excluded?: Set<string>,
    hasSchema?: boolean
  ): string {
    const now = Date.now();
    const allModels = this.getModels(kind);
    const hasGeminiModels = allModels.some((model) =>
      model.toLowerCase().startsWith("gemini-")
    );
    const pool =
      hasSchema && hasGeminiModels
        ? allModels.filter((model) => model.toLowerCase().startsWith("gemini-"))
        : allModels;

    for (const model of pool) {
      if (excluded?.has(model)) continue;
      const cooldownUntil = this.modelCooldowns.get(model) ?? 0;
      if (now >= cooldownUntil) {
        return model;
      }
    }

    const firstAvailable = pool.find((m) => !excluded?.has(m));
    if (firstAvailable) return firstAvailable;
    return pool[0];
  }

  markRateLimited(model: string): void {
    const cooldownMs = this.getCooldownMs();
    const until = Date.now() + cooldownMs;
    this.modelCooldowns.set(model, until);
    logger.warn(
      `[ApiRotationPool] Model "${model}" rate-limited. Cooling down for ${cooldownMs / 1000}s until ${new Date(until).toISOString()}.`
    );
  }

  clearCooldown(model: string): void {
    if (this.modelCooldowns.has(model)) {
      this.modelCooldowns.delete(model);
    }
  }

  isAvailable(model: string): boolean {
    const until = this.modelCooldowns.get(model) ?? 0;
    return Date.now() >= until;
  }

  getThinkingLevel(
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

  getCooldowns(): ModelCooldown[] {
    const now = Date.now();
    const result: ModelCooldown[] = [];
    for (const [model, cooldownUntil] of this.modelCooldowns.entries()) {
      if (cooldownUntil > now) {
        result.push({ model, cooldownUntil });
      }
    }
    return result;
  }

  clearCooldowns(): void {
    this.modelCooldowns.clear();
    this.envKeyCooldowns.clear();
    this.envKeyInvalid.clear();
    this.keyModelCooldowns.clear();
  }

  isKeyModelCooldown(keyId: string, model: string): boolean {
    const cacheKey = `${keyId}:${model}`;
    const cooldownUntil = this.keyModelCooldowns.get(cacheKey) ?? 0;
    return Date.now() < cooldownUntil;
  }

  getEnvKeysStatus(): {
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

    const now = Date.now();
    let active = 0;
    let rateLimited = 0;
    let invalid = 0;

    for (let index = 0; index < envKeys.length; index++) {
      const keyId = `env-key-${index}`;
      if (this.envKeyInvalid.has(keyId)) {
        invalid++;
      } else {
        const cooldownUntil = this.envKeyCooldowns.get(keyId) ?? 0;
        if (now < cooldownUntil) {
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

  async executeWithRotation<T>(options: {
    userId?: string;
    modelKind: AiModelKind;
    purpose: AiPurpose;
    hasSchema?: boolean;
    execute: (context: {
      key: string;
      model: string;
      keyId?: string;
      isUserKey: boolean;
    }) => Promise<T>;
  }): Promise<{ result: T; resolvedModel: string }> {
    const allModels = this.getModels(options.modelKind);
    const hasGeminiModels = allModels.some((model) =>
      model.toLowerCase().startsWith("gemini-")
    );
    const models =
      options.hasSchema && hasGeminiModels
        ? allModels.filter((model) => model.toLowerCase().startsWith("gemini-"))
        : allModels;
    const exhaustedModels = new Set<string>();
    let resolvedModel = this.getNextAvailable(
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

      const model = this.getNextAvailable(
        options.modelKind,
        exhaustedModels,
        options.hasSchema
      );
      exhaustedModels.add(model);
      resolvedModel = model;

      try {
        const result = await this.executeWithModelRotation(model, options);
        this.clearCooldown(model);
        return { result, resolvedModel };
      } catch (err: any) {
        const isRateLimit =
          isRateLimitError(err) ||
          err.code === "all_keys_failed" ||
          err.message?.includes("keys available");

        if (isRateLimit && modelIdx < models.length - 1) {
          this.markRateLimited(model);
          return attempt(modelIdx + 1);
        }
        throw err;
      }
    };

    return attempt(0);
  }

  private async executeWithModelRotation<T>(
    model: string,
    options: {
      userId?: string;
      purpose: AiPurpose;
      execute: (context: {
        key: string;
        model: string;
        keyId?: string;
        isUserKey: boolean;
      }) => Promise<T>;
    }
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

      const resolved = await this.resolveApiKey(
        options.userId,
        excludedKeyIds,
        model
      );
      const { key, id: keyId, isUserKey } = resolved;

      logger.debug(
        `[ApiRotationPool] Resolved key ID ${keyId || "env_key"} (${
          isUserKey ? "user" : "system"
        }), masked: ${key.slice(0, 4)}...`
      );

      let apiCallFailed = false;

      try {
        const result = await options.execute({ key, model, keyId, isUserKey });

        if (keyId && !isUserKey) {
          await this.restoreKeyToActive(keyId);
        }

        return result;
      } catch (err: any) {
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
              await this.markKeyRateLimited(
                keyId,
                err.message || "Rate limit exceeded",
                model
              );
            } else if (isInvalidKeyError(err)) {
              logger.error(
                `[ApiRotationPool] Marking key ID ${keyId} invalid: ${err.message || err}`
              );
              await this.markKeyInvalid(
                keyId,
                err.message || "Invalid API key"
              );
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
      }
    }

    throw new AiError("AI provider error: request failed.", "unknown");
  }

  private async resolveApiKey(
    userId?: string,
    excludedKeyIds?: Set<string>,
    model?: string
  ): Promise<{ key: string; id?: string; isUserKey: boolean }> {
    const now = Date.now();

    // 1. Prefer user-owned API keys
    if (userId) {
      const userKeys = await this.keyRepo.getUserKeys(userId);
      const usableUserKeys = userKeys.filter((k) => {
        if (excludedKeyIds && excludedKeyIds.has(k.id)) return false;
        if (k.status === "invalid") return false;
        if (k.status === "rate_limited" && k.rateLimitedAt) {
          const oneMinuteAgo = new Date(now - 60 * 1000);
          if (k.rateLimitedAt > oneMinuteAgo) return false;
        }
        if (model) {
          const cooldownUntil =
            this.keyModelCooldowns.get(`${k.id}:${model}`) ?? 0;
          if (now < cooldownUntil) return false;
        }
        return true;
      });

      if (usableUserKeys.length > 0) {
        const picked =
          usableUserKeys[Math.floor(Math.random() * usableUserKeys.length)];
        const key = decryptApiKey(picked.encryptedKey);
        logger.debug(
          `[KeyResolver] Selected user custom API key keyId=${picked.id}`
        );
        return { key, id: picked.id, isUserKey: true };
      }

      // Legacy fallback
      const legacyKeyStr = await this.keyRepo.getLegacyUserKey(userId);
      if (legacyKeyStr) {
        try {
          let encryptedKeys: string[] = [];
          const rawValue = legacyKeyStr.trim();
          if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
            encryptedKeys = JSON.parse(rawValue);
          } else {
            encryptedKeys = [rawValue];
          }

          const candidateKeys: { encKey: string; id: string }[] = [];
          for (let index = 0; index < encryptedKeys.length; index++) {
            const encKey = encryptedKeys[index];
            const id = `user-key-${index}`;
            if (!excludedKeyIds || !excludedKeyIds.has(id)) {
              candidateKeys.push({ encKey, id });
            }
          }

          if (candidateKeys.length > 0) {
            const picked =
              candidateKeys[Math.floor(Math.random() * candidateKeys.length)];
            const key = decryptApiKey(picked.encKey);
            if (key) {
              logger.debug(
                `[KeyResolver] Selected legacy user custom API key keyId=${picked.id}`
              );
              return { key, id: picked.id, isUserKey: true };
            }
          } else if (encryptedKeys.length > 0) {
            const key = decryptApiKey(encryptedKeys[0]);
            if (key) {
              logger.debug(
                "[KeyResolver] Selected legacy user custom API key keyId=user-key-0 (fallback)"
              );
              return { key, id: "user-key-0", isUserKey: true };
            }
          }
        } catch (e) {
          logger.error(
            `Failed to decrypt/parse user custom keys for ${userId}:`,
            e
          );
        }
      }
    }

    // 2. Check system keys
    const systemKeys = await this.keyRepo.getSystemKeys();
    const activeKeys = systemKeys.filter((k) => {
      if (excludedKeyIds && excludedKeyIds.has(k.id)) return false;
      if (k.status === "invalid") return false;
      if (k.status === "rate_limited" && k.rateLimitedAt) {
        const oneMinuteAgo = new Date(now - 60 * 1000);
        if (k.rateLimitedAt > oneMinuteAgo) return false;
      }
      if (model) {
        const cooldownUntil =
          this.keyModelCooldowns.get(`${k.id}:${model}`) ?? 0;
        if (now < cooldownUntil) return false;
      }
      return true;
    });

    if (activeKeys.length > 0) {
      const picked = activeKeys[Math.floor(Math.random() * activeKeys.length)];
      try {
        const key = decryptApiKey(picked.encryptedKey);
        logger.debug(
          `[KeyResolver] Selected database system key keyId=${picked.id} name=${picked.name}`
        );
        return { key, id: picked.id, isUserKey: false };
      } catch (e) {
        logger.error(`Failed to decrypt system key ${picked.name}:`, e);
      }
    }

    // 3. Environment Fallbacks
    let envKeys: string[] = [];
    if (process.env.GEMINI_API_KEYS) {
      envKeys = parseApiKeys(process.env.GEMINI_API_KEYS);
    }
    if (envKeys.length === 0 && process.env.GEMINI_API_KEY) {
      envKeys = parseApiKeys(process.env.GEMINI_API_KEY);
    }

    if (envKeys.length > 0) {
      const activeEnvKeys: { key: string; id: string }[] = [];
      for (let index = 0; index < envKeys.length; index++) {
        const key = envKeys[index];
        const id = `env-key-${index}`;
        if (excludedKeyIds && excludedKeyIds.has(id)) continue;
        if (this.envKeyInvalid.has(id)) continue;
        const cooldownUntil = this.envKeyCooldowns.get(id) ?? 0;
        if (now < cooldownUntil) continue;
        if (model) {
          const modelCooldownUntil =
            this.keyModelCooldowns.get(`${id}:${model}`) ?? 0;
          if (now < modelCooldownUntil) continue;
        }
        activeEnvKeys.push({ key, id });
      }

      if (activeEnvKeys.length > 0) {
        const picked =
          activeEnvKeys[Math.floor(Math.random() * activeEnvKeys.length)];
        logger.debug(
          `[KeyResolver] Selected environment fallback API key keyId=${picked.id}`
        );
        return { key: picked.key, id: picked.id, isUserKey: false };
      }
    }

    throw new Error("No active system, user, or fallback API keys available.");
  }

  public async markKeyRateLimited(
    keyId: string,
    errorMsg: string,
    model?: string
  ): Promise<void> {
    const cooldownMs = 60 * 1000;
    const cooldownUntil = Date.now() + cooldownMs;

    if (model) {
      const cacheKey = `${keyId}:${model}`;
      this.keyModelCooldowns.set(cacheKey, cooldownUntil);
      logger.warn(
        `API key marked rate_limited for model ${model} (in-memory): ${keyId}. Error: ${errorMsg}`
      );
      return;
    }

    if (keyId.startsWith("env-key-")) {
      this.envKeyCooldowns.set(keyId, cooldownUntil);
      logger.warn(
        `API key marked rate_limited (in-memory): ${keyId}. Error: ${errorMsg}`
      );
      return;
    }

    try {
      await this.keyRepo.updateKeyStatus(keyId, "rate_limited", errorMsg);
      logger.warn(`API key marked rate_limited: ${keyId}. Error: ${errorMsg}`);
    } catch (e) {
      logger.error(`Failed to update rate_limited status for key ${keyId}:`, e);
    }
  }

  public async markKeyInvalid(keyId: string, errorMsg: string): Promise<void> {
    if (keyId.startsWith("env-key-")) {
      this.envKeyInvalid.add(keyId);
      logger.error(
        `API key marked invalid (in-memory): ${keyId}. Error: ${errorMsg}`
      );
      return;
    }
    try {
      await this.keyRepo.updateKeyStatus(keyId, "invalid", errorMsg);
      logger.error(`API key marked invalid: ${keyId}. Error: ${errorMsg}`);
    } catch (e) {
      logger.error(`Failed to update invalid status for key ${keyId}:`, e);
    }
  }

  public async restoreKeyToActive(keyId: string): Promise<void> {
    if (keyId.startsWith("env-key-")) {
      this.envKeyCooldowns.delete(keyId);
      logger.info(`Environment API key reset to active (in-memory): ${keyId}`);
      return;
    }
    try {
      await this.keyRepo.updateKeyStatus(keyId, "active", null);
      logger.info(`API key reset to active: ${keyId}`);
    } catch (e) {
      logger.error(`Failed to restore active status for key ${keyId}:`, e);
    }
  }
}
