import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { SCHEMA_VERSIONS } from "@/domain/constants";
import { hashCanonicalPayload } from "@/lib/crypto";
import { getLogger } from "@/lib/logger";
import type { LLMProvider, KeyResolver, AiRequestRecorder } from "../ports";
import { DrizzleKeyResolver } from "./key-resolver";
import { DrizzleAiRequestRecorder } from "./ai-request-recorder";
import { JsonRepairStrategy } from "./json-repair";
import { providerRotationPool } from "./model-pool";
import {
  AiError,
  getGeminiThinkingLevel,
  zodToGeminiSchema,
  estimateCost,
  isRateLimitError,
  isInvalidKeyError,
} from "./gemini-utils";

const logger = getLogger("d.m.ai.GeminiLLMProvider", "ai-provider");

export { parseApiKeys } from "./key-resolver";

export class GeminiLLMProvider implements LLMProvider {
  constructor(
    private readonly keyResolver: KeyResolver = new DrizzleKeyResolver(),
    private readonly requestRecorder: AiRequestRecorder = new DrizzleAiRequestRecorder(),
    private readonly jsonRepairStrategy: JsonRepairStrategy = new JsonRepairStrategy()
  ) {}

  private async callGeminiWithKeyRetry(
    userId: string | undefined,
    prompt: string,
    model: string,
    thinkingLevel: ThinkingLevel,
    zodSchema?: z.ZodTypeAny,
    onThought?: (text: string) => Promise<void>
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    let attempts = 0;
    const maxKeyAttempts = 3;
    const excludedKeyIds = new Set<string>();

    while (attempts < maxKeyAttempts) {
      attempts++;

      let resolved;
      try {
        resolved = await this.keyResolver.resolveApiKeyWithExclusions(
          userId,
          excludedKeyIds
        );
      } catch (err: any) {
        throw new AiError(
          `Failed to resolve API key: ${err.message}`,
          "missing_api_key"
        );
      }

      const { key, id: keyId, isUserKey } = resolved;

      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const config = {
          responseMimeType: "application/json",
          responseSchema: zodSchema ? zodToGeminiSchema(zodSchema) : undefined,
          systemInstruction:
            "When progress notes are available, write short Vietnamese learner-facing status notes only. Do not mention code, JSON, schemas, prompts, chain-of-thought, or hidden reasoning. The final response must be valid JSON only.",
          thinkingConfig: onThought
            ? {
                includeThoughts: true,
                thinkingLevel,
              }
            : undefined,
        };

        let text = "";
        let inputTokens = 0;
        let outputTokens = 0;

        if (onThought) {
          const response = await ai.models.generateContentStream({
            model,
            contents: prompt,
            config,
          });

          for await (const chunk of response) {
            for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
              if (!part.text) continue;
              if (part.thought) {
                await onThought(part.text);
              } else {
                text += part.text;
              }
            }
            if (chunk.usageMetadata) {
              inputTokens = chunk.usageMetadata.promptTokenCount ?? 0;
              outputTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
            }
          }
        } else {
          const result = await ai.models.generateContent({
            model,
            contents: prompt,
            config,
          });

          text = result.text ?? "";
          if (result.usageMetadata) {
            inputTokens = result.usageMetadata.promptTokenCount ?? 0;
            outputTokens = result.usageMetadata.candidatesTokenCount ?? 0;
          }
        }

        // If key was rate-limited or had errors but succeeded now, restore it
        if (keyId && !isUserKey && !keyId.startsWith("env-key-")) {
          await this.keyResolver.restoreKeyToActive(keyId);
        }

        return { text, inputTokens, outputTokens };
      } catch (err: any) {
        logger.warn(
          `[AI Provider] Call failed (model: ${model}, key: ${keyId || "env/user"}, attempt: ${attempts}): ${err.message || err}`
        );

        if (isUserKey) {
          throw new AiError(
            `Custom User API Key failed: ${err.message || err}`,
            "user_key_failed"
          );
        }

        if (keyId) {
          excludedKeyIds.add(keyId);
          if (!keyId.startsWith("env-key-")) {
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
          }
        } else {
          // env fallback key failed — re-throw directly, no more keys to try
          throw err;
        }

        if (attempts >= maxKeyAttempts) {
          // Signal to the outer model-rotation loop that all keys are exhausted for this model
          throw new AiError(
            `All API keys exhausted for model "${model}". Last error: ${err.message || err}`,
            "all_keys_failed"
          );
        }
      }
    }

    throw new AiError("AI provider error: request failed.", "unknown");
  }

  private async callGeminiWithRetry(
    userId: string | undefined,
    prompt: string,
    modelKind: "analysis" | "fast",
    zodSchema?: z.ZodTypeAny,
    onThought?: (text: string) => Promise<void>
  ): Promise<{
    text: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
  }> {
    const globalThinkingLevel = getGeminiThinkingLevel();
    const models = providerRotationPool.getModels(modelKind);
    const exhaustedModels = new Set<string>();

    for (let modelIdx = 0; modelIdx < models.length; modelIdx++) {
      const model = providerRotationPool.getNextAvailable(
        modelKind,
        exhaustedModels
      );
      exhaustedModels.add(model);

      if (!providerRotationPool.isAvailable(model)) {
        logger.warn(`Model "${model}" is cooling down — trying next.`);
      }

      const thinkingLevel = providerRotationPool.getThinkingLevel(
        model,
        globalThinkingLevel
      );

      try {
        const result = await this.callGeminiWithKeyRetry(
          userId,
          prompt,
          model,
          thinkingLevel,
          zodSchema,
          onThought
        );
        // Success — clear any lingering model cooldown
        providerRotationPool.clearCooldown(model);
        return { ...result, model };
      } catch (err: any) {
        const isRateLimit =
          isRateLimitError(err) || err.code === "all_keys_failed";

        if (isRateLimit) {
          providerRotationPool.markRateLimited(model);
          logger.warn(
            `Model "${model}" rate-limited or keys exhausted. Rotating to next model (${modelIdx + 1}/${models.length} tried).`
          );
          // Try next model
          continue;
        }

        // Non-transient error (invalid key for user key, parse error, etc.) — re-throw
        throw err;
      }
    }

    throw new AiError(
      `All models in the ${modelKind} pool are rate-limited or unavailable. Tried: ${Array.from(exhaustedModels).join(", ")}.`,
      "all_models_failed"
    );
  }

  async generateJson<T>(options: {
    userId?: string;
    lessonId?: string;
    purpose: "analysis" | "exercise_generation" | "grading" | "repair";
    prompt: string;
    promptVersion: string;
    schemaVersion: string;
    schema: z.ZodType<T>;
    modelKind: "analysis" | "fast";
    onThought?: (text: string) => Promise<void>;
  }): Promise<T> {
    const payloadHash = hashCanonicalPayload({
      prompt: options.prompt,
      promptVersion: options.promptVersion,
      schemaVersion:
        SCHEMA_VERSIONS[options.schemaVersion as keyof typeof SCHEMA_VERSIONS],
    });
    const startedAt = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let resolvedModel = providerRotationPool.getNextAvailable(
      options.modelKind
    );
    let status: "succeeded" | "failed" = "failed";
    let errorClass: string | null = null;

    try {
      const { data, model, inputTokens, outputTokens } =
        await this.jsonRepairStrategy.execute(
          options,
          async (prompt, useOnThought) => {
            return this.callGeminiWithRetry(
              options.userId,
              prompt,
              options.modelKind,
              options.schema,
              useOnThought ? options.onThought : undefined
            );
          }
        );

      resolvedModel = model;
      totalInputTokens = inputTokens;
      totalOutputTokens = outputTokens;
      status = "succeeded";
      return data;
    } catch (error) {
      errorClass =
        error instanceof AiError
          ? error.code
          : error instanceof Error
            ? error.name
            : "unknown";
      throw error;
    } finally {
      // Record AI request
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
        latencyMs: Date.now() - startedAt,
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
}
