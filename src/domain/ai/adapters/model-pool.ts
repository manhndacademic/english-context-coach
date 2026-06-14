import { ThinkingLevel } from "@google/genai";

const DEFAULT_ANALYSIS_MODELS = [
  "gemini-3.1-flash-lite",
  "gemma-4-31b-it",
  "gemma-4-26b-a4b-it",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
];

const DEFAULT_FAST_MODELS = [
  "gemini-3.1-flash-lite",
  "gemma-4-31b-it",
  "gemma-4-26b-a4b-it",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
];

/** Models that only support MINIMAL or HIGH thinking levels. */
const GEMMA_MODELS = new Set(["gemma-4-31b-it", "gemma-4-26b-a4b-it"]);

/** Thinking levels not supported by Gemma; map them to MINIMAL. */
const GEMMA_UNSUPPORTED_THINKING = new Set<string>(["LOW", "MEDIUM"]);

function parseModelList(env: string | undefined, defaults: string[]): string[] {
  if (!env?.trim()) return defaults;
  const parsed = env.split(",").map((m) => m.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : defaults;
}

export interface ModelCooldown {
  model: string;
  cooldownUntil: number;
}

export class ProviderRotationPool {
  private analysisModels: string[];
  private fastModels: string[];

  /** Map from modelId → cooldownUntil epoch ms */
  private cooldowns = new Map<string, number>();

  constructor(analysisModels?: string[], fastModels?: string[]) {
    this.analysisModels =
      analysisModels ??
      parseModelList(process.env.GEMINI_ANALYSIS_MODELS, DEFAULT_ANALYSIS_MODELS);
    this.fastModels =
      fastModels ??
      parseModelList(process.env.GEMINI_FAST_MODELS, DEFAULT_FAST_MODELS);
  }

  private getCooldownMs(): number {
    const envVal = process.env.GEMINI_COOLDOWN_MS;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
    return 30_000;
  }

  getModels(kind: "analysis" | "fast"): string[] {
    return kind === "analysis" ? this.analysisModels : this.fastModels;
  }

  getNextAvailable(kind: "analysis" | "fast", excluded?: Set<string>): string {
    const now = Date.now();
    const pool = this.getModels(kind);

    for (const model of pool) {
      if (excluded?.has(model)) continue;
      const cooldownUntil = this.cooldowns.get(model) ?? 0;
      if (now >= cooldownUntil) {
        return model;
      }
    }

    // All models are cooling down or excluded — best-effort: return first non-excluded
    const firstAvailable = pool.find((m) => !excluded?.has(m));
    if (firstAvailable) return firstAvailable;

    // Last resort: ignore exclusions too
    return pool[0];
  }

  markRateLimited(model: string): void {
    const cooldownMs = this.getCooldownMs();
    const until = Date.now() + cooldownMs;
    this.cooldowns.set(model, until);
    console.warn(
      `[ProviderRotationPool] Model "${model}" rate-limited. Cooling down for ${cooldownMs / 1000}s until ${new Date(until).toISOString()}.`
    );
  }

  clearCooldown(model: string): void {
    if (this.cooldowns.has(model)) {
      this.cooldowns.delete(model);
    }
  }

  isAvailable(model: string): boolean {
    const until = this.cooldowns.get(model) ?? 0;
    return Date.now() >= until;
  }

  getThinkingLevel(model: string, requestedLevel: ThinkingLevel): ThinkingLevel {
    if (GEMMA_MODELS.has(model)) {
      const levelKey = Object.keys(ThinkingLevel).find(
        (k) => ThinkingLevel[k as keyof typeof ThinkingLevel] === requestedLevel
      );
      if (levelKey && GEMMA_UNSUPPORTED_THINKING.has(levelKey)) {
        return ThinkingLevel.MINIMAL;
      }
    }
    return requestedLevel;
  }

  getCooldowns(): ModelCooldown[] {
    const now = Date.now();
    return Array.from(this.cooldowns.entries())
      .filter(([, until]) => until > now)
      .map(([model, cooldownUntil]) => ({ model, cooldownUntil }));
  }
}

export const providerRotationPool = new ProviderRotationPool();
