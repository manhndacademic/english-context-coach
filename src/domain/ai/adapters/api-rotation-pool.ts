import { ThinkingLevel } from "@google/genai";
import { getLogger } from "@/lib/logger";
import { DrizzleKeyResolver } from "./key-resolver";
import type { KeyResolver } from "../ports";
import { isRateLimitError, isInvalidKeyError, AiError } from "./gemini-utils";
import type { AiModelKind, AiPurpose } from "@/domain/types";

const logger = getLogger("d.m.ai.ApiRotationPool", "ai-provider");

const DEFAULT_ANALYSIS_MODELS = [
  "gemini-3.1-flash-lite",
  "gemma-4-31b-it",
  "gemma-4-26b-a4b-it",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
];

const DEFAULT_FAST_MODELS = [
  "gemini-3.1-flash-lite",
  "gemma-4-31b-it",
  "gemma-4-26b-a4b-it",
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
  private readonly cooldowns = new Map<string, number>();

  constructor(
    private readonly keyResolver: KeyResolver = new DrizzleKeyResolver(),
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
      const cooldownUntil = this.cooldowns.get(model) ?? 0;
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
    this.cooldowns.set(model, until);
    logger.warn(
      `[ApiRotationPool] Model "${model}" rate-limited. Cooling down for ${cooldownMs / 1000}s until ${new Date(until).toISOString()}.`
    );
  }

  clearCooldown(model: string): void {
    if (this.cooldowns.has(model)) {
      this.cooldowns.delete(model);
    }
  }

  isAvailable(model: string): boolean {
    const until = this.cooldowns.get(model) ?? 0;
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
    return Array.from(this.cooldowns.entries())
      .filter(([, until]) => until > now)
      .map(([model, cooldownUntil]) => ({ model, cooldownUntil }));
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

    for (let modelIdx = 0; modelIdx < models.length; modelIdx++) {
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
          err.message?.includes("No keys available");

        if (isRateLimit && modelIdx < models.length - 1) {
          this.markRateLimited(model);
          continue; // rotates to next model
        }
        throw err;
      }
    }

    throw new AiError(
      `All models in the ${options.modelKind} pool are rate-limited or unavailable.`,
      "all_models_failed"
    );
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

      const resolved = await this.keyResolver.resolveApiKeyWithExclusions(
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
          await this.keyResolver.restoreKeyToActive(keyId);
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
              await this.keyResolver.markKeyRateLimited(
                keyId,
                err.message || "Rate limit exceeded",
                model
              );
            } else if (isInvalidKeyError(err)) {
              logger.error(
                `[ApiRotationPool] Marking key ID ${keyId} invalid: ${err.message || err}`
              );
              await this.keyResolver.markKeyInvalid(
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
}

export const apiRotationPool = new ApiRotationPool();
