import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ThinkingLevel } from "@google/genai";
import { ProviderRotationPool } from "./model_pool";

describe("ProviderRotationPool", () => {
  let pool: ProviderRotationPool;

  beforeEach(() => {
    pool = new ProviderRotationPool(
      ["model-a", "model-b", "model-c"],
      ["fast-a", "fast-b"]
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── getModels ──────────────────────────────────────────────────────────────

  describe("getModels", () => {
    it("returns analysis models", () => {
      expect(pool.getModels("analysis")).toEqual(["model-a", "model-b", "model-c"]);
    });

    it("returns fast models", () => {
      expect(pool.getModels("fast")).toEqual(["fast-a", "fast-b"]);
    });
  });

  // ─── isAvailable ────────────────────────────────────────────────────────────

  describe("isAvailable", () => {
    it("returns true for a fresh model", () => {
      expect(pool.isAvailable("model-a")).toBe(true);
    });

    it("returns false for a rate-limited model", () => {
      pool.markRateLimited("model-a");
      expect(pool.isAvailable("model-a")).toBe(false);
    });

    it("returns true again after cooldown expires", () => {
      vi.useFakeTimers();
      pool.markRateLimited("model-a");
      expect(pool.isAvailable("model-a")).toBe(false);

      vi.advanceTimersByTime(30_001);
      expect(pool.isAvailable("model-a")).toBe(true);
    });
  });

  // ─── markRateLimited + clearCooldown ────────────────────────────────────────

  describe("markRateLimited / clearCooldown", () => {
    it("marks model as unavailable", () => {
      pool.markRateLimited("model-b");
      expect(pool.isAvailable("model-b")).toBe(false);
    });

    it("clearCooldown restores availability", () => {
      pool.markRateLimited("model-b");
      pool.clearCooldown("model-b");
      expect(pool.isAvailable("model-b")).toBe(true);
    });

    it("clearCooldown is idempotent on a model that was never limited", () => {
      expect(() => pool.clearCooldown("model-a")).not.toThrow();
      expect(pool.isAvailable("model-a")).toBe(true);
    });
  });

  // ─── getNextAvailable ────────────────────────────────────────────────────────

  describe("getNextAvailable", () => {
    it("returns the first model in the pool when all are available", () => {
      expect(pool.getNextAvailable("analysis")).toBe("model-a");
    });

    it("skips rate-limited model and returns the next one", () => {
      pool.markRateLimited("model-a");
      expect(pool.getNextAvailable("analysis")).toBe("model-b");
    });

    it("skips explicitly excluded models", () => {
      const excluded = new Set(["model-a"]);
      expect(pool.getNextAvailable("analysis", excluded)).toBe("model-b");
    });

    it("skips both rate-limited and excluded models", () => {
      pool.markRateLimited("model-a");
      const excluded = new Set(["model-b"]);
      expect(pool.getNextAvailable("analysis", excluded)).toBe("model-c");
    });

    it("returns best-effort first non-excluded when all models are cooling down", () => {
      pool.markRateLimited("model-a");
      pool.markRateLimited("model-b");
      pool.markRateLimited("model-c");
      // best-effort: returns first model (even if cooling down) so caller can try
      const result = pool.getNextAvailable("analysis");
      expect(["model-a", "model-b", "model-c"]).toContain(result);
    });

    it("returns first model even when all are excluded (last resort)", () => {
      const excluded = new Set(["model-a", "model-b", "model-c"]);
      const result = pool.getNextAvailable("analysis", excluded);
      // Last resort: ignore exclusions, return pool[0]
      expect(result).toBe("model-a");
    });

    it("respects cooldown recovery after 30 seconds", () => {
      vi.useFakeTimers();
      pool.markRateLimited("model-a");
      expect(pool.getNextAvailable("analysis")).toBe("model-b");

      vi.advanceTimersByTime(30_001);
      expect(pool.getNextAvailable("analysis")).toBe("model-a");
    });
  });

  // ─── getCooldowns ────────────────────────────────────────────────────────────

  describe("getCooldowns", () => {
    it("returns empty array when no models are cooling down", () => {
      expect(pool.getCooldowns()).toEqual([]);
    });

    it("returns active cooldowns", () => {
      pool.markRateLimited("model-a");
      pool.markRateLimited("model-c");
      const cooldowns = pool.getCooldowns();
      expect(cooldowns.map((c) => c.model)).toEqual(
        expect.arrayContaining(["model-a", "model-c"])
      );
    });

    it("does not include expired cooldowns", () => {
      vi.useFakeTimers();
      pool.markRateLimited("model-a");
      vi.advanceTimersByTime(30_001);
      expect(pool.getCooldowns()).toEqual([]);
    });
  });

  // ─── getThinkingLevel ────────────────────────────────────────────────────────

  describe("getThinkingLevel (Gemma compatibility)", () => {
    const GEMMA_MODELS = ["gemma-4-31b-it", "gemma-4-26b-a4b-it"];
    const NON_GEMMA_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3-flash-preview"];

    // Use a fresh pool with gemma models in it
    let gemmaPool: ProviderRotationPool;
    beforeEach(() => {
      gemmaPool = new ProviderRotationPool(
        ["gemma-4-31b-it", "gemma-4-26b-a4b-it", "gemini-3.1-flash-lite"],
        ["gemini-3.1-flash-lite"]
      );
    });

    it.each(GEMMA_MODELS)("maps LOW → MINIMAL for %s", (model) => {
      expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.LOW)).toBe(ThinkingLevel.MINIMAL);
    });

    it.each(GEMMA_MODELS)("maps MEDIUM → MINIMAL for %s", (model) => {
      expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.MEDIUM)).toBe(ThinkingLevel.MINIMAL);
    });

    it.each(GEMMA_MODELS)("preserves MINIMAL for %s", (model) => {
      expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.MINIMAL)).toBe(ThinkingLevel.MINIMAL);
    });

    it.each(GEMMA_MODELS)("preserves HIGH for %s", (model) => {
      expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.HIGH)).toBe(ThinkingLevel.HIGH);
    });

    it.each(NON_GEMMA_MODELS)("passes through any level unchanged for non-Gemma %s", (model) => {
      expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.LOW)).toBe(ThinkingLevel.LOW);
      expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.MEDIUM)).toBe(ThinkingLevel.MEDIUM);
      expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.HIGH)).toBe(ThinkingLevel.HIGH);
      expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.MINIMAL)).toBe(ThinkingLevel.MINIMAL);
    });
  });

  // ─── env var override ────────────────────────────────────────────────────────

  describe("env var override", () => {
    it("uses GEMINI_ANALYSIS_MODELS env var when set", () => {
      const originalEnv = process.env.GEMINI_ANALYSIS_MODELS;
      process.env.GEMINI_ANALYSIS_MODELS = "custom-model-1,custom-model-2";
      try {
        const envPool = new ProviderRotationPool();
        expect(envPool.getModels("analysis")).toEqual(["custom-model-1", "custom-model-2"]);
      } finally {
        process.env.GEMINI_ANALYSIS_MODELS = originalEnv;
      }
    });

    it("uses GEMINI_FAST_MODELS env var when set", () => {
      const originalEnv = process.env.GEMINI_FAST_MODELS;
      process.env.GEMINI_FAST_MODELS = "fast-custom-1";
      try {
        const envPool = new ProviderRotationPool();
        expect(envPool.getModels("fast")).toEqual(["fast-custom-1"]);
      } finally {
        process.env.GEMINI_FAST_MODELS = originalEnv;
      }
    });

    it("falls back to defaults when env var is empty string", () => {
      const originalEnv = process.env.GEMINI_ANALYSIS_MODELS;
      process.env.GEMINI_ANALYSIS_MODELS = "";
      try {
        const envPool = new ProviderRotationPool();
        // Should use defaults (starts with gemini-3.1-flash-lite)
        expect(envPool.getModels("analysis")[0]).toBe("gemini-3.1-flash-lite");
      } finally {
        process.env.GEMINI_ANALYSIS_MODELS = originalEnv;
      }
    });

    it("trims whitespace from model names in env var", () => {
      const originalEnv = process.env.GEMINI_ANALYSIS_MODELS;
      process.env.GEMINI_ANALYSIS_MODELS = " model-x , model-y ";
      try {
        const envPool = new ProviderRotationPool();
        expect(envPool.getModels("analysis")).toEqual(["model-x", "model-y"]);
      } finally {
        process.env.GEMINI_ANALYSIS_MODELS = originalEnv;
      }
    });
  });
});
