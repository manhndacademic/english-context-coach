import { z } from "zod";
import type { AiPurpose, AiRequestStatus } from "@/domain/types";
import type { ApiKeyRepository } from "../../application/ports/api-key-repository";
import type { AiRequestRecorder } from "../../application/ports/ai-request-recorder";
import type {
  LlmProvider,
  GenerateJsonOptions,
} from "../../application/ports/llm-provider";
import type { Prompt } from "../../application/ports/prompt";
import * as requestRecorderModule from "../logging/record-ai-request";
import { createApiRotationPool, ApiRotationPool } from "./api-rotation-pool";
import { hashCanonicalPayload } from "@/lib/crypto";
import { getGeminiThinkingLevel, AiError, estimateCost } from "./gemini-utils";
import { executeCallWithRepair } from "./helpers/execute-call-with-repair";
import { callGeminiRaw } from "./helpers/gemini-api-call";

export interface CallRawOptions {
  apiKey: string;
  model: string;
  prompt: string;
  purpose: AiPurpose;
  zodSchema?: z.ZodTypeAny;
  onThought?: (text: string) => Promise<void>;
}

export interface CallRawResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export type CallRawOverrideFn = (
  options: CallRawOptions
) => Promise<CallRawResult>;

export interface GeminiLlmProviderOptions {
  keyRepo?: ApiKeyRepository;
  requestRecorder?: AiRequestRecorder;
  apiRotationPool?: ApiRotationPool;
  callRawOverride?: CallRawOverrideFn;
}

export type GeminiLLMProviderOptions = GeminiLlmProviderOptions;

export { generationConfigForPurpose } from "./helpers/gemini-config";
export { parseApiKeys } from "./api-rotation-pool";

export function createGeminiLlmProvider(
  options: GeminiLlmProviderOptions = {}
): LlmProvider & { apiRotationPool: ReturnType<typeof createApiRotationPool> } {
  const pool =
    options.apiRotationPool ??
    createApiRotationPool({ keyRepo: options.keyRepo });
  const recorder = options.requestRecorder ?? {
    recordRequest: requestRecorderModule.recordAiRequest,
  };

  async function generateJson<T>(genOpts: GenerateJsonOptions<T>): Promise<T> {
    const callRawOverride = options.callRawOverride;

    async function callGeminiRawDelegated(
      rawOpts: CallRawOptions
    ): Promise<CallRawResult> {
      const globalThinkingLevel = getGeminiThinkingLevel();
      const thinkingLevel = pool.getThinkingLevel(
        rawOpts.model,
        globalThinkingLevel
      );

      return callGeminiRaw(rawOpts, {
        callRawOverride,
        thinkingLevel,
      });
    }

    async function executeCallAndValidation<R>(
      key: string,
      model: string,
      keyId: string | undefined,
      prompt: Prompt<R>,
      onThought: ((text: string) => Promise<void>) | undefined,
      accumulateTokens: (inTokens: number, outTokens: number) => void
    ): Promise<R> {
      return executeCallWithRepair({
        key,
        model,
        keyId,
        prompt,
        onThought,
        callGeminiRaw: callGeminiRawDelegated,
        accumulateTokens,
      });
    }

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
