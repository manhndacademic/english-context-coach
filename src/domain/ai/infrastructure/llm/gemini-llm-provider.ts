import type { LlmProvider } from "../../application/ports/llm-provider";
import * as requestRecorderModule from "../logging/record-ai-request";
import { createApiRotationPool } from "./api-rotation-pool";
import { createGenerateJsonUseCase } from "../../application/use-cases/generate-json";
import type {
  GeminiLlmProviderOptions,
  GenerateJsonOptions,
} from "../../domain/types";

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

  const generateUseCase = createGenerateJsonUseCase(
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
