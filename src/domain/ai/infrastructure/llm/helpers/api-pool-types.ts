export const DEFAULT_ANALYSIS_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
];

export const DEFAULT_FAST_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
];

export const GEMMA_MODELS = new Set(["gemma-4-31b-it", "gemma-4-26b-a4b-it"]);
export const GEMMA_UNSUPPORTED_THINKING = new Set<string>(["LOW", "MEDIUM"]);

export function parseModelList(
  env: string | undefined,
  defaults: string[]
): string[] {
  if (!env?.trim()) return defaults;
  const parsed = env.split(",").flatMap((m) => {
    const trimmed = m.trim();
    return trimmed ? [trimmed] : [];
  });
  return parsed.length > 0 ? parsed : defaults;
}

export function parseApiKeys(envKeysStr: string | undefined): string[] {
  if (!envKeysStr) return [];
  const rawParts = envKeysStr.split(/[,\n]+/);
  const keys: string[] = [];
  for (const part of rawParts) {
    let clean = part.split("#")[0].split("//")[0];
    clean = clean.trim();
    if (clean) {
      keys.push(clean);
    }
  }
  return keys;
}

export class LlmValidationError extends Error {
  constructor(
    message: string,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = "LlmValidationError";
  }
}

export interface ModelCooldown {
  model: string;
  cooldownUntil: number;
}
