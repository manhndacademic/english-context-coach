import { GeminiLLMProvider } from "./adapters/gemini-provider";
import { DrizzleKeyResolver } from "./adapters/key-resolver";
import type { LLMProvider, KeyResolver } from "./ports";

let cachedProvider: LLMProvider | null = null;
let cachedKeyResolver: KeyResolver | null = null;

export function getLLMProvider(): LLMProvider {
  if (!cachedProvider) {
    cachedProvider = new GeminiLLMProvider();
  }
  return cachedProvider;
}

export function getKeyResolver(): KeyResolver {
  if (!cachedKeyResolver) {
    cachedKeyResolver = new DrizzleKeyResolver();
  }
  return cachedKeyResolver;
}

export type { LLMProvider, KeyResolver } from "./ports";
