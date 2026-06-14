import { DefaultTextProcessor } from "./processor";
import type { TextProcessor } from "./processor";

let cachedProcessor: TextProcessor | null = null;

export function getTextProcessor(): TextProcessor {
  if (!cachedProcessor) {
    cachedProcessor = new DefaultTextProcessor();
  }
  return cachedProcessor;
}

export type { TextProcessor } from "./processor";
