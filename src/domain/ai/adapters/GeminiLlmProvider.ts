import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getLogger } from "@/lib/logger";
import type { AiRequestStatus } from "@/domain/types";
import type { LlmProvider, Prompt } from "../ports";
import * as requestRecorderModule from "./recordAiRequest";
import { hashCanonicalPayload } from "@/lib/crypto";
import { createApiRotationPool } from "./ApiRotationPool";
import {
  getGeminiThinkingLevel,
  AiError,
  estimateCost,
  inlineRefs,
  cleanSchemaForGemini,
} from "./geminiUtils";
import { generationConfigForPurpose } from "./helpers/geminiConfig";
import { executeCallWithRepair } from "./helpers/executeCallWithRepair";
import type {
  GeminiLlmProviderOptions,
  CallRawOptions,
  CallRawResult,
  GenerateJsonOptions,
} from "../types";

const logger = getLogger("d.m.ai.GeminiLlmProvider", "ai-provider");

export { generationConfigForPurpose } from "./helpers/geminiConfig";
export { parseApiKeys } from "./ApiRotationPool";

export function createGeminiLlmProvider(
  options: GeminiLlmProviderOptions = {}
) {
  const pool =
    options.apiRotationPool ??
    createApiRotationPool({ keyRepo: options.keyRepo });
  const recorder = options.requestRecorder ?? {
    recordRequest: requestRecorderModule.recordAiRequest,
  };

  async function callGeminiRaw(
    rawOpts: CallRawOptions
  ): Promise<CallRawResult> {
    if (options.callRawOverride) {
      return options.callRawOverride(rawOpts);
    }
    const globalThinkingLevel = getGeminiThinkingLevel();
    const thinkingLevel = pool.getThinkingLevel(
      rawOpts.model,
      globalThinkingLevel
    );

    const modelLower = rawOpts.model.toLowerCase();
    const isGemini3 = modelLower.includes("gemini-3");
    const isThinkingModel =
      modelLower.includes("gemini-2") ||
      isGemini3 ||
      modelLower.includes("-thinking");

    const ai = new GoogleGenAI({ apiKey: rawOpts.apiKey });
    const purposeConfig = generationConfigForPurpose(rawOpts.purpose);

    const timeoutMs =
      parseInt(process.env.GEMINI_TIMEOUT_MS ?? "", 10) || 60_000;
    const controller = new AbortController();

    const config = {
      ...purposeConfig,
      responseMimeType: "application/json",
      responseJsonSchema: rawOpts.zodSchema
        ? cleanSchemaForGemini(inlineRefs(zodToJsonSchema(rawOpts.zodSchema)))
        : undefined,
      thinkingConfig: rawOpts.onThought
        ? {
            includeThoughts: true,
            thinkingLevel,
          }
        : isGemini3
          ? {
              thinkingLevel: ThinkingLevel.MINIMAL,
            }
          : isThinkingModel
            ? {
                thinkingBudget: 0,
              }
            : undefined,
      abortSignal: controller.signal,
    };

    let text = "";
    let inputTokens = 0;
    let outputTokens = 0;

    logger.info(
      `[AI Provider] Calling Gemini API (model: ${rawOpts.model}, purpose: ${rawOpts.purpose})...`
    );
    const callStartTime = Date.now();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (rawOpts.onThought) {
        const streamResult = await callGeminiStream({
          ai,
          model: rawOpts.model,
          prompt: rawOpts.prompt,
          config,
          onThought: rawOpts.onThought,
        });
        text = streamResult.text;
        inputTokens = streamResult.inputTokens;
        outputTokens = streamResult.outputTokens;
      } else {
        const unaryResult = await callGeminiUnary({
          ai,
          model: rawOpts.model,
          prompt: rawOpts.prompt,
          config,
        });
        text = unaryResult.text;
        inputTokens = unaryResult.inputTokens;
        outputTokens = unaryResult.outputTokens;
      }
    } catch (err: any) {
      if (
        err.name === "AbortError" ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        throw new AiError(
          `Gemini API request timed out after ${timeoutMs}ms`,
          "timeout"
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutHandle);
    }

    logger.info(
      `[AI Provider] Gemini API Success (model: ${rawOpts.model}) in ${Date.now() - callStartTime}ms. Tokens: in=${inputTokens}, out=${outputTokens}`
    );

    return { text, inputTokens, outputTokens };
  }

  async function callGeminiStream(streamOpts: {
    ai: GoogleGenAI;
    model: string;
    prompt: string;
    config: any;
    onThought: (text: string) => Promise<void>;
  }): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const { ai, model, prompt, config, onThought } = streamOpts;
    let text = "";
    let inputTokens = 0;
    let outputTokens = 0;

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

    return { text, inputTokens, outputTokens };
  }

  async function callGeminiUnary(unaryOpts: {
    ai: GoogleGenAI;
    model: string;
    prompt: string;
    config: any;
  }): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const { ai, model, prompt, config } = unaryOpts;
    let text = "";
    let inputTokens = 0;
    let outputTokens = 0;

    const result = await ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });

    const parts = result.candidates?.[0]?.content?.parts ?? [];
    if (parts.length > 0) {
      let partsText = "";
      for (const part of parts) {
        if (!part.thought && part.text) {
          partsText += part.text;
        }
      }
      text = partsText;
    } else {
      text = result.text ?? "";
    }

    if (result.usageMetadata) {
      inputTokens = result.usageMetadata.promptTokenCount ?? 0;
      outputTokens = result.usageMetadata.candidatesTokenCount ?? 0;
    }

    return { text, inputTokens, outputTokens };
  }

  async function executeCallAndValidation<T>(
    key: string,
    model: string,
    keyId: string | undefined,
    prompt: Prompt<T>,
    onThought: ((text: string) => Promise<void>) | undefined,
    accumulateTokens: (inTokens: number, outTokens: number) => void
  ): Promise<T> {
    return executeCallWithRepair({
      key,
      model,
      keyId,
      prompt,
      onThought,
      callGeminiRaw,
      accumulateTokens,
    });
  }

  async function generateJson<T>(genOpts: GenerateJsonOptions<T>): Promise<T> {
    const payloadHash = hashCanonicalPayload({
      prompt: genOpts.prompt.render(),
      promptVersion: genOpts.prompt.promptVersion,
      schemaVersion: genOpts.prompt.schemaVersion,
    });
    const startedAt = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let resolvedModel = pool.getNextAvailable(
      genOpts.prompt.modelKind,
      undefined,
      true
    );
    let status: AiRequestStatus = "failed";
    let errorClass: string | null = null;
    let errorMessage: string | null = null;

    try {
      const rotationResult = await pool.executeWithRotation<T>({
        userId: genOpts.userId,
        modelKind: genOpts.prompt.modelKind,
        purpose: genOpts.prompt.purpose,
        hasSchema: true,
        execute: async ({ key, model, keyId }) => {
          resolvedModel = model;
          return await executeCallAndValidation(
            key,
            model,
            keyId,
            genOpts.prompt,
            genOpts.onThought,
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
      await recorder.recordRequest({
        userId: genOpts.userId,
        lessonId: genOpts.lessonId,
        purpose: genOpts.prompt.purpose,
        provider: "gemini",
        model: resolvedModel,
        promptVersion: genOpts.prompt.promptVersion,
        schemaVersion: genOpts.prompt.schemaVersion,
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

  return {
    generateJson,
    apiRotationPool: pool,
  };
}

export function createGeminiLLMProvider(
  options: GeminiLlmProviderOptions = {}
) {
  return createGeminiLlmProvider(options);
}

export type GeminiLlmProvider = ReturnType<typeof createGeminiLlmProvider>;
export type GeminiLLMProvider = GeminiLlmProvider;
export type { LlmProvider as LLMProvider };
