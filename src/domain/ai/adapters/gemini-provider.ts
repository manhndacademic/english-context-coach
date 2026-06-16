import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getLogger } from "@/lib/logger";
import type { LLMProvider, KeyResolver, AiRequestRecorder } from "../ports";
import { DrizzleKeyResolver } from "./key-resolver";
import { DrizzleAiRequestRecorder } from "./ai-request-recorder";
import { SCHEMA_VERSIONS } from "@/domain/constants";
import { hashCanonicalPayload } from "@/lib/crypto";
import { ProviderRotationPool, providerRotationPool } from "./model-pool";
import {
  getGeminiThinkingLevel,
  zodToGeminiSchema,
  extractJson,
  coerceJsonForSchema,
  isRateLimitError,
  isInvalidKeyError,
  AiError,
  estimateCost,
} from "./gemini-utils";

const logger = getLogger("d.m.ai.GeminiLLMProvider", "ai-provider");

type AiPurpose = "analysis" | "exercise_generation" | "grading" | "repair";

function getEnvTokenLimit(envVar: string, defaultValue: number): number {
  const envVal = process.env[envVar];
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
    logger.warn(
      `[AI Config] Invalid value for environment variable ${envVar}: "${envVal}". Falling back to default: ${defaultValue}`
    );
  }
  return defaultValue;
}

export function generationConfigForPurpose(purpose: AiPurpose) {
  switch (purpose) {
    case "grading":
      return {
        maxOutputTokens: getEnvTokenLimit(
          "GEMINI_MAX_OUTPUT_TOKENS_GRADING",
          700
        ),
        temperature: 0.1,
        topP: 0.8,
        systemInstruction:
          "Return compact valid JSON only. Do not include markdown. Do not list multiple alternative answers unless explicitly requested. For grading, naturalAnswer must be exactly one best answer in the expected target language (Vietnamese or English depending on the prompt). Keep all fields concise and bounded.",
      };
    case "analysis":
      return {
        maxOutputTokens: getEnvTokenLimit(
          "GEMINI_MAX_OUTPUT_TOKENS_ANALYSIS",
          8192
        ),
        systemInstruction:
          "When progress notes are available, write short Vietnamese learner-facing status notes only. Do not mention code, JSON, schemas, prompts, chain-of-thought, or hidden reasoning. The final response must be valid JSON only.",
      };
    case "exercise_generation":
      return {
        maxOutputTokens: getEnvTokenLimit(
          "GEMINI_MAX_OUTPUT_TOKENS_EXERCISE",
          2200
        ),
        systemInstruction:
          "When progress notes are available, write short Vietnamese learner-facing status notes only. Do not mention code, JSON, schemas, prompts, chain-of-thought, or hidden reasoning. The final response must be valid JSON only.",
      };
    case "repair":
      return {
        maxOutputTokens: getEnvTokenLimit(
          "GEMINI_MAX_OUTPUT_TOKENS_REPAIR",
          1200
        ),
        temperature: 0.1,
        systemInstruction:
          "Repair the response into compact valid JSON only. Do not include markdown or commentary. Preserve the original meaning while fitting the requested schema.",
      };
  }
}

export { parseApiKeys } from "./key-resolver";

export class GeminiLLMProvider implements LLMProvider {
  constructor(
    private readonly keyResolver: KeyResolver = new DrizzleKeyResolver(),
    private readonly requestRecorder: AiRequestRecorder = new DrizzleAiRequestRecorder(),
    private readonly modelPool: ProviderRotationPool = providerRotationPool,
    private readonly callRawOverride?: (options: {
      apiKey: string;
      model: string;
      prompt: string;
      purpose: AiPurpose;
      zodSchema?: z.ZodTypeAny;
      onThought?: (text: string) => Promise<void>;
    }) => Promise<{ text: string; inputTokens: number; outputTokens: number }>
  ) {}

  private async callGeminiRaw(options: {
    apiKey: string;
    model: string;
    prompt: string;
    purpose: AiPurpose;
    zodSchema?: z.ZodTypeAny;
    onThought?: (text: string) => Promise<void>;
  }): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    if (this.callRawOverride) {
      return this.callRawOverride({
        apiKey: options.apiKey,
        model: options.model,
        prompt: options.prompt,
        purpose: options.purpose,
        zodSchema: options.zodSchema,
        onThought: options.onThought,
      });
    }
    const globalThinkingLevel = getGeminiThinkingLevel();
    const thinkingLevel = providerRotationPool.getThinkingLevel(
      options.model,
      globalThinkingLevel
    );

    const ai = new GoogleGenAI({ apiKey: options.apiKey });
    const purposeConfig = generationConfigForPurpose(options.purpose);
    const config = {
      ...purposeConfig,
      responseMimeType: "application/json",
      responseSchema: options.zodSchema
        ? zodToGeminiSchema(options.zodSchema)
        : undefined,
      thinkingConfig: options.onThought
        ? {
            includeThoughts: true,
            thinkingLevel,
          }
        : undefined,
    };

    let text = "";
    let inputTokens = 0;
    let outputTokens = 0;

    logger.info(
      `[AI Provider] Calling Gemini API (model: ${options.model}, purpose: ${options.purpose})...`
    );
    const callStartTime = Date.now();

    if (options.onThought) {
      const response = await ai.models.generateContentStream({
        model: options.model,
        contents: options.prompt,
        config,
      });

      for await (const chunk of response) {
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          if (!part.text) continue;
          if (part.thought) {
            await options.onThought(part.text);
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
        model: options.model,
        contents: options.prompt,
        config,
      });

      text = result.text ?? "";
      if (result.usageMetadata) {
        inputTokens = result.usageMetadata.promptTokenCount ?? 0;
        outputTokens = result.usageMetadata.candidatesTokenCount ?? 0;
      }
    }

    logger.info(
      `[AI Provider] Gemini API Success (model: ${options.model}) in ${Date.now() - callStartTime}ms. Tokens: in=${inputTokens}, out=${outputTokens}`
    );

    return { text, inputTokens, outputTokens };
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

    const models = this.modelPool.getModels(options.modelKind);
    const exhaustedModels = new Set<string>();
    let resolvedModel = this.modelPool.getNextAvailable(options.modelKind);
    let status: "succeeded" | "failed" = "failed";
    let errorClass: string | null = null;
    let errorMessage: string | null = null;

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
      errorMessage = error instanceof Error ? error.message : String(error);
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
        errorMessage,
      });
    }
  }

  private async executeWithModel<T>(
    model: string,
    options: {
      userId?: string;
      purpose: "analysis" | "exercise_generation" | "grading" | "repair";
      prompt: string;
      promptVersion: string;
      schemaVersion: string;
      schema: z.ZodType<T>;
      onThought?: (text: string) => Promise<void>;
    },
    accumulateTokens: (inTokens: number, outTokens: number) => void
  ): Promise<T> {
    const excludedKeyIds = new Set<string>();
    let attempts = 0;
    const maxKeyAttempts = 5;

    while (attempts < maxKeyAttempts) {
      attempts++;
      const resolved = await this.keyResolver.resolveApiKeyWithExclusions(
        options.userId,
        excludedKeyIds,
        model
      );
      const { key, id: keyId, isUserKey } = resolved;

      try {
        const callResult = await this.callGeminiRaw({
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
        const { repairPrompt } = await import("@/lib/ai/prompts");
        const repairResult = await this.callGeminiRaw({
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
        if (keyId) {
          excludedKeyIds.add(keyId);
          if (!isUserKey) {
            if (isRateLimitError(err)) {
              await this.keyResolver.markKeyRateLimited(
                keyId,
                err.message || "Rate limit exceeded",
                model
              );
            } else if (isInvalidKeyError(err)) {
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
        } else {
          throw err;
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
