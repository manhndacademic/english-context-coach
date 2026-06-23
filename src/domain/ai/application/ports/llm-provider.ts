import type { GenerateJsonOptions } from "../../domain/types";

export type GenerateJsonFn = <T>(options: GenerateJsonOptions<T>) => Promise<T>;

export interface LlmProvider {
  generateJson: GenerateJsonFn;
}

export type LLMProvider = LlmProvider;
