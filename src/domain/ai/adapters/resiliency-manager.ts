import { z } from "zod";
import type { KeyResolver, AiRequestRecorder } from "../ports";
import { ProviderRotationPool, providerRotationPool } from "./model-pool";
import {
  extractJson,
  coerceJsonForSchema,
  isRateLimitError,
  isInvalidKeyError,
  AiError,
  estimateCost,
} from "./gemini-utils";
import { repairPrompt } from "@/lib/ai/prompts";
import { SCHEMA_VERSIONS } from "@/domain/constants";
import { hashCanonicalPayload } from "@/lib/crypto";

export interface LLMClientCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMClient {
  call(options: {
    apiKey: string;
    model: string;
    prompt: string;
    purpose: string;
    zodSchema?: z.ZodTypeAny;
    onThought?: (text: string) => Promise<void>;
  }): Promise<LLMClientCallResult>;
}

export interface LLMResiliencyOptions<T> {
  userId?: string;
  lessonId?: string;
  purpose: "analysis" | "exercise_generation" | "grading" | "repair";
  prompt: string;
  promptVersion: string;
  schemaVersion: string;
  schema: z.ZodType<T>;
  modelKind: "analysis" | "fast";
  onThought?: (text: string) => Promise<void>;
}

export interface LLMResiliencyManager {
  execute<T>(options: LLMResiliencyOptions<T>, client: LLMClient): Promise<T>;
}

export class DefaultLLMResiliencyManager implements LLMResiliencyManager {
  constructor(
    private keyResolver: KeyResolver,
    private requestRecorder: AiRequestRecorder,
    private modelPool: ProviderRotationPool = providerRotationPool
  ) {}

  async execute<T>(
    options: LLMResiliencyOptions<T>,
    client: LLMClient
  ): Promise<T> {
    const payloadHash = hashCanonicalPayload({
      prompt: options.prompt,
      promptVersion: options.promptVersion,
      schemaVersion:
        SCHEMA_VERSIONS[options.schemaVersion as keyof typeof SCHEMA_VERSIONS],
    });
    const startedAt = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const models = this.modelPool.getModels(options.modelKind);
    const exhaustedModels = new Set<string>();
    let resolvedModel = this.modelPool.getNextAvailable(options.modelKind);
    let status: "succeeded" | "failed" = "failed";
    let errorClass: string | null = null;

    try {
      for (let modelIdx = 0; modelIdx < models.length; modelIdx++) {
        const model = this.modelPool.getNextAvailable(
          options.modelKind,
          exhaustedModels
        );
        exhaustedModels.add(model);
        resolvedModel = model;

        try {
          const result = await this.executeWithModel(
            model,
            options,
            client,
            (inTokens, outTokens) => {
              totalInputTokens += inTokens;
              totalOutputTokens += outTokens;
            }
          );
          this.modelPool.clearCooldown(model);
          status = "succeeded";
          return result;
        } catch (err: any) {
          const isRateLimit =
            isRateLimitError(err) ||
            err.code === "all_keys_failed" ||
            err.message?.includes("No keys available");

          if (isRateLimit && modelIdx < models.length - 1) {
            this.modelPool.markRateLimited(model);
            continue; // rotates to next model
          }
          throw err;
        }
      }

      throw new AiError(
        `All models in the ${options.modelKind} pool are rate-limited or unavailable.`,
        "all_models_failed"
      );
    } catch (error) {
      errorClass =
        error instanceof AiError
          ? error.code
          : error instanceof Error
            ? error.name
            : "unknown";
      throw error;
    } finally {
      const latencyMs = Date.now() - startedAt;
      await this.requestRecorder.recordRequest({
        userId: options.userId,
        lessonId: options.lessonId,
        purpose: options.purpose,
        provider: "gemini",
        model: resolvedModel,
        promptVersion: options.promptVersion,
        schemaVersion:
          SCHEMA_VERSIONS[
            options.schemaVersion as keyof typeof SCHEMA_VERSIONS
          ],
        payloadHash,
        status,
        latencyMs,
        inputTokens: totalInputTokens || null,
        outputTokens: totalOutputTokens || null,
        costMicros: estimateCost(
          resolvedModel,
          totalInputTokens,
          totalOutputTokens
        ),
        errorClass,
      });
    }
  }

  private async executeWithModel<T>(
    model: string,
    options: LLMResiliencyOptions<T>,
    client: LLMClient,
    accumulateTokens: (inTokens: number, outTokens: number) => void
  ): Promise<T> {
    const excludedKeyIds = new Set<string>();
    let attempts = 0;
    const maxKeyAttempts = 3;

    while (attempts < maxKeyAttempts) {
      attempts++;
      const resolved = await this.keyResolver.resolveApiKeyWithExclusions(
        options.userId,
        excludedKeyIds
      );
      const { key, id: keyId, isUserKey } = resolved;

      try {
        const callResult = await client.call({
          apiKey: key,
          model,
          prompt: options.prompt,
          purpose: options.purpose,
          zodSchema: options.schema,
          onThought: options.onThought,
        });
        accumulateTokens(callResult.inputTokens, callResult.outputTokens);

        let rawText = callResult.text;
        let extracted = extractJson(rawText);
        try {
          const coerced = coerceJsonForSchema(
            JSON.parse(extracted),
            options.schemaVersion as keyof typeof SCHEMA_VERSIONS
          );
          const parsed = options.schema.safeParse(coerced);
          if (parsed.success) {
            if (keyId && !isUserKey) {
              await this.keyResolver.restoreKeyToActive(keyId);
            }
            return parsed.data;
          }
        } catch {
          // JSON parse failure or coercion failure -> trigger repair
        }

        // Trigger repair flow
        const repairResult = await client.call({
          apiKey: key,
          model,
          prompt: repairPrompt(rawText, options.schemaVersion),
          purpose: "repair",
          zodSchema: options.schema,
        });
        accumulateTokens(repairResult.inputTokens, repairResult.outputTokens);

        const repairedExtracted = extractJson(repairResult.text);
        const coercedRepaired = coerceJsonForSchema(
          JSON.parse(repairedExtracted),
          options.schemaVersion as keyof typeof SCHEMA_VERSIONS
        );

        if (keyId && !isUserKey) {
          await this.keyResolver.restoreKeyToActive(keyId);
        }

        return options.schema.parse(coercedRepaired);
      } catch (err: any) {
        if (isUserKey) {
          throw new AiError(
            `Custom User API Key failed: ${err.message || err}`,
            "user_key_failed"
          );
        }

        if (keyId) {
          excludedKeyIds.add(keyId);
          if (isRateLimitError(err)) {
            await this.keyResolver.markKeyRateLimited(
              keyId,
              err.message || "Rate limit exceeded"
            );
          } else if (isInvalidKeyError(err)) {
            await this.keyResolver.markKeyInvalid(
              keyId,
              err.message || "Invalid API key"
            );
          }
        } else {
          throw err;
        }

        if (attempts >= maxKeyAttempts) {
          throw new AiError(
            `All API keys exhausted for model "${model}". Last error: ${err.message || err}`,
            "all_keys_failed"
          );
        }
      }
    }

    throw new AiError("AI provider error: request failed.", "unknown");
  }
}
