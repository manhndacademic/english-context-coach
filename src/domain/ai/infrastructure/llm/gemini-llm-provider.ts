import { z } from "zod";
import type { AiPurpose } from "@/domain/types";
import type { ApiKeyRepository } from "../../application/ports/api-key-repository";
import type { AiRequestRecorder } from "../../application/ports/ai-request-recorder";
import type {
  LlmProvider,
  GenerateJsonOptions,
} from "../../application/ports/llm-provider";
import * as requestRecorderModule from "../logging/record-ai-request";
import { GenerateJsonService } from "../../application/use-cases/generate-json";
import { createApiRotationPool, ApiRotationPool } from "./api-rotation-pool";

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

  const generateUseCase = new GenerateJsonService(
    pool,
    recorder,
    options.callRawOverride
  );

  async function generateJson<T>(genOpts: GenerateJsonOptions<T>): Promise<T> {
    return generateUseCase.execute(genOpts);
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
