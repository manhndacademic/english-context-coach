import type { AiRequestStatus } from "@/domain/types";
import type { GenerateJsonOptions } from "../ports/llm-provider";
import type {
  CallRawOptions,
  CallRawResult,
} from "../../infrastructure/llm/gemini-llm-provider";
import type { Prompt } from "../ports/prompt";
import type { AiRequestRecorder } from "../ports/ai-request-recorder";
import type { ApiRotationPool } from "../../infrastructure/llm/api-rotation-pool";
import { hashCanonicalPayload } from "@/lib/crypto";
import {
  getGeminiThinkingLevel,
  AiError,
  estimateCost,
} from "../../infrastructure/llm/gemini-utils";
import { executeCallWithRepair } from "../../infrastructure/llm/helpers/execute-call-with-repair";
import { callGeminiRaw } from "../../infrastructure/llm/helpers/gemini-api-call";

export interface GenerateJsonUseCase {
  execute<T>(genOpts: GenerateJsonOptions<T>): Promise<T>;
}

export class GenerateJsonService implements GenerateJsonUseCase {
  constructor(
    private readonly pool: ApiRotationPool,
    private readonly recorder: AiRequestRecorder,
    private readonly callRawOverride?: (
      options: CallRawOptions
    ) => Promise<CallRawResult>
  ) {}

  async execute<T>(genOpts: GenerateJsonOptions<T>): Promise<T> {
    const { pool, recorder, callRawOverride } = this;

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
}
