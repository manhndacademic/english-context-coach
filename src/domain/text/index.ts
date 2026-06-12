import { DefaultTextProcessor } from "./adapters/default-processor";
import type { TextProcessor } from "./ports";

let cachedProcessor: TextProcessor | null = null;

export function getTextProcessor(): TextProcessor {
  if (!cachedProcessor) {
    cachedProcessor = new DefaultTextProcessor();
  }
  return cachedProcessor;
}

export type { TextProcessor } from "./ports";
