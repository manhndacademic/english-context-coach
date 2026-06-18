import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getLogger } from "@/lib/logger";
import type { LLMProvider, KeyResolver, AiRequestRecorder } from "../ports";
import { DrizzleKeyResolver } from "./key-resolver";
import { DrizzleAiRequestRecorder } from "./ai-request-recorder";
import { SCHEMA_VERSIONS } from "@/domain/constants";
import { hashCanonicalPayload } from "@/lib/crypto";
import { ApiRotationPool, LlmValidationError } from "./api-rotation-pool";
import {
  getGeminiThinkingLevel,
  zodToGeminiSchema,
  AiError,
  estimateCost,
} from "./gemini-utils";
import { JsonParserService } from "./json-parser-service";

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
          4096
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
          16384
        ),
        systemInstruction:
          "When progress notes are available, write short Vietnamese learner-facing status notes only. Do not mention code, JSON, schemas, prompts, chain-of-thought, or hidden reasoning. The final response must be valid JSON only.",
      };
    case "exercise_generation":
      return {
        maxOutputTokens: getEnvTokenLimit(
          "GEMINI_MAX_OUTPUT_TOKENS_EXERCISE",
          8192
        ),
        systemInstruction:
          "When progress notes are available, write short Vietnamese learner-facing status notes only. Do not mention code, JSON, schemas, prompts, chain-of-thought, or hidden reasoning. The final response must be valid JSON only.",
      };
    case "repair":
      return {
        maxOutputTokens: getEnvTokenLimit(
          "GEMINI_MAX_OUTPUT_TOKENS_REPAIR",
          16384
        ),
        temperature: 0.1,
        systemInstruction:
          "Repair the response into compact valid JSON only. Do not include markdown or commentary. Preserve the original meaning while fitting the requested schema.",
      };
  }
}

export { parseApiKeys } from "./key-resolver";

export class GeminiLLMProvider implements LLMProvider {
  private readonly apiRotationPool: ApiRotationPool;

  constructor(
    readonly keyResolver: KeyResolver = new DrizzleKeyResolver(),
    private readonly requestRecorder: AiRequestRecorder = new DrizzleAiRequestRecorder(),
    apiRotationPool?: ApiRotationPool,
    private readonly callRawOverride?: (options: {
      apiKey: string;
      model: string;
      prompt: string;
      purpose: AiPurpose;
      zodSchema?: z.ZodTypeAny;
      onThought?: (text: string) => Promise<void>;
    }) => Promise<{ text: string; inputTokens: number; outputTokens: number }>
  ) {
    this.apiRotationPool = apiRotationPool ?? new ApiRotationPool(keyResolver);
  }

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
    const thinkingLevel = this.apiRotationPool.getThinkingLevel(
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

      const parts = result.candidates?.[0]?.content?.parts ?? [];
      if (parts.length > 0) {
        text = parts
          .filter((part) => !part.thought && part.text)
          .map((part) => part.text)
          .join("");
      } else {
        text = result.text ?? "";
      }

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
    let resolvedModel = this.apiRotationPool.getNextAvailable(
      options.modelKind
    );
    let status: "succeeded" | "failed" = "failed";
    let errorClass: string | null = null;
    let errorMessage: string | null = null;

    try {
      const rotationResult = await this.apiRotationPool.executeWithRotation({
        userId: options.userId,
        modelKind: options.modelKind,
        purpose: options.purpose,
        execute: async ({ key, model, keyId }) => {
          resolvedModel = model;
          return await this.executeCallAndValidation(
            key,
            model,
            keyId,
            options,
            (inTokens, outTokens) => {
              totalInputTokens += inTokens;
              totalOutputTokens += outTokens;
            }
          );
        },
      });
      resolvedModel = rotationResult.resolvedModel;
      status = "succeeded";
      return rotationResult.result;
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

  private async executeCallAndValidation<T>(
    key: string,
    model: string,
    keyId: string | undefined,
    options: {
      purpose: "analysis" | "exercise_generation" | "grading" | "repair";
      prompt: string;
      schemaVersion: string;
      schema: z.ZodType<T>;
      onThought?: (text: string) => Promise<void>;
    },
    accumulateTokens: (inTokens: number, outTokens: number) => void
  ): Promise<T> {
    let callResult;
    try {
      logger.trace(
        `[GeminiProvider] Raw prompt sent to model ${model} for purpose ${
          options.purpose
        }:\n${options.prompt}`
      );
      callResult = await this.callGeminiRaw({
        apiKey: key,
        model,
        prompt: options.prompt,
        purpose: options.purpose,
        zodSchema: options.schema,
        onThought: options.onThought,
      });
    } catch (err) {
      throw err;
    }
    accumulateTokens(callResult.inputTokens, callResult.outputTokens);

    let rawText = callResult.text;
    logger.trace(
      `[GeminiProvider] Raw text response received from model ${model} for purpose ${
        options.purpose
      }:\n${rawText}`
    );
    let parsed = null;

    try {
      const coerced = JsonParserService.parse(
        rawText,
        options.schemaVersion as keyof typeof SCHEMA_VERSIONS
      );
      parsed = options.schema.safeParse(coerced);
      if (parsed.success) {
        logger.debug(
          `[GeminiProvider] Successful validation on first attempt for key ID ${
            keyId || "env_key"
          }`
        );
        return parsed.data;
      } else {
        logger.warn(
          `[GeminiProvider] First attempt response validation failed for purpose ${
            options.purpose
          }. Errors: ${JSON.stringify(parsed.error.errors)}`
        );
      }
    } catch (parseErr: any) {
      logger.warn(
        `[GeminiProvider] First attempt JSON parsing/coercion failed for purpose ${
          options.purpose
        }: ${parseErr.message || parseErr}`
      );
    }

    // Trigger repair flow
    const { repairPrompt } = await import("@/lib/ai/prompts");
    const repairPromptText = repairPrompt(rawText, options.schemaVersion);
    logger.debug(
      `[GeminiProvider] Triggering repair flow using key ID ${keyId || "env_key"}`
    );
    logger.trace(
      `[GeminiProvider] Raw repair prompt sent:\n${repairPromptText}`
    );
    let repairResult;
    try {
      repairResult = await this.callGeminiRaw({
        apiKey: key,
        model,
        prompt: repairPromptText,
        purpose: "repair",
        zodSchema: options.schema,
      });
    } catch (err) {
      throw err;
    }
    accumulateTokens(repairResult.inputTokens, repairResult.outputTokens);

    logger.trace(
      `[GeminiProvider] Raw repair text response received:\n${repairResult.text}`
    );
    let coercedRepaired;
    try {
      coercedRepaired = JsonParserService.parse(
        repairResult.text,
        options.schemaVersion as keyof typeof SCHEMA_VERSIONS
      );
    } catch (parseErr: any) {
      logger.error(
        `[GeminiProvider] Repaired response JSON parsing failed: ${
          parseErr.message || parseErr
        }`
      );
      throw new LlmValidationError(
        `Repaired response JSON parsing failed: ${parseErr.message || parseErr}`,
        parseErr
      );
    }

    try {
      const finalData = options.schema.parse(coercedRepaired);
      logger.debug(
        `[GeminiProvider] Successful validation on repaired response for key ID ${
          keyId || "env_key"
        }`
      );
      return finalData;
    } catch (zodErr: any) {
      logger.error(
        `[GeminiProvider] Repaired response validation failed. Errors: ${JSON.stringify(
          zodErr.errors
        )}. Coerced: ${JSON.stringify(coercedRepaired)}`
      );
      throw new LlmValidationError(
        `Repaired response Zod validation failed: ${JSON.stringify(zodErr.errors)}`,
        zodErr
      );
    }
  }
}
