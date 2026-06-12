import { GeminiLLMProvider } from "./adapters/gemini-provider";
import type { LLMProvider } from "./ports";

let cachedProvider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (!cachedProvider) {
    cachedProvider = new GeminiLLMProvider();
  }
  return cachedProvider;
}

export type { LLMProvider } from "./ports";
