import { ThinkingLevel } from "@google/genai";

/**
 * Ordered list of models to try for each modelKind.
 * Priority: fastest/cheapest first; escalate when rate-limited.
 * Can be overridden via env vars:
 *   GEMINI_ANALYSIS_MODELS=model1,model2,...
 *   GEMINI_FAST_MODELS=model1,model2,...
 */
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

const COOLDOWN_MS = 30_000;

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

/**
 * ProviderRotationPool — singleton that tracks per-model in-process cooldowns.
 *
 * Represents the "model" dimension of ApiRotationPool (see CONTEXT.md).
 * The key dimension is handled separately in `callGeminiWithRetry`.
 *
 * State is in-process and resets on worker restart. This is intentional:
 * model cooldowns are short-lived (30 s) and not worth a DB round-trip.
 * See ADR 0012.
 */
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

  getModels(kind: "analysis" | "fast"): string[] {
    return kind === "analysis" ? this.analysisModels : this.fastModels;
  }

  /**
   * Returns the first model in the pool that is not currently cooling down.
   * If all models are cooling down, returns the first model (best-effort).
   */
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

  /**
   * Marks a model as rate-limited with a 30-second cooldown.
   */
  markRateLimited(model: string): void {
    const until = Date.now() + COOLDOWN_MS;
    this.cooldowns.set(model, until);
    console.warn(
      `[ProviderRotationPool] Model "${model}" rate-limited. Cooling down for ${COOLDOWN_MS / 1000}s until ${new Date(until).toISOString()}.`
    );
  }

  /**
   * Clears the cooldown for a model (called on successful response).
   */
  clearCooldown(model: string): void {
    if (this.cooldowns.has(model)) {
      this.cooldowns.delete(model);
    }
  }

  /**
   * Returns whether a model is currently in cooldown.
   */
  isAvailable(model: string): boolean {
    const until = this.cooldowns.get(model) ?? 0;
    return Date.now() >= until;
  }

  /**
   * Maps the global thinking level to one supported by the given model.
   * Gemma models only support MINIMAL and HIGH.
   * If the requested level is LOW or MEDIUM and the model is Gemma → MINIMAL.
   */
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

  /**
   * Returns all models that are currently in cooldown (for testing/observability).
   */
  getCooldowns(): ModelCooldown[] {
    const now = Date.now();
    return Array.from(this.cooldowns.entries())
      .filter(([, until]) => until > now)
      .map(([model, cooldownUntil]) => ({ model, cooldownUntil }));
  }
}

/** Singleton instance shared across all requests in the process. See ADR 0012. */
export const providerRotationPool = new ProviderRotationPool();
