import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createApiRotationPool,
  type ApiRotationPool,
  LlmValidationError,
} from "./api-rotation-pool";
import type { ApiKeyRepository } from "../../application/ports/api-key-repository";
import { ThinkingLevel } from "@google/genai";

vi.mock("@/lib/crypto", () => ({
  decryptApiKey: (key: string) => key,
  encryptApiKey: (key: string) => key,
  sha256: (text: string) => text,
  hashCanonicalPayload: (payload: any) => JSON.stringify(payload),
}));

class MockApiKeyRepository implements ApiKeyRepository {
  systemKeys: Array<{
    id: string;
    name: string;
    encryptedKey: string;
    status: string;
    rateLimitedAt: Date | null;
  }> = [];
  userKeys = new Map<
    string,
    Array<{
      id: string;
      encryptedKey: string;
      status: string;
      rateLimitedAt: Date | null;
    }>
  >();
  legacyUserKeys = new Map<string, string>();

  updatedKeys: Array<{
    keyId: string;
    status: "active" | "rate_limited" | "invalid";
    errorMessage: string | null;
  }> = [];
  savedUserKeys = new Map<string, string | null>();

  async getSystemKeys() {
    return this.systemKeys;
  }

  async getUserKeys(userId: string) {
    return this.userKeys.get(userId) ?? [];
  }

  async getLegacyUserKey(userId: string) {
    return this.legacyUserKeys.get(userId) ?? null;
  }

  async updateKeyStatus(
    keyId: string,
    status: "active" | "rate_limited" | "invalid",
    errorMessage: string | null
  ): Promise<void> {
    this.updatedKeys.push({ keyId, status, errorMessage });

    // Update in-memory collections to reflect state changes
    const sysKey = this.systemKeys.find((k) => k.id === keyId);
    if (sysKey) {
      sysKey.status = status;
      sysKey.rateLimitedAt = status === "rate_limited" ? new Date() : null;
    }

    for (const [_, keys] of this.userKeys.entries()) {
      const userKey = keys.find((k) => k.id === keyId);
      if (userKey) {
        userKey.status = status;
        userKey.rateLimitedAt = status === "rate_limited" ? new Date() : null;
      }
    }
  }

  async saveUserApiKey(
    userId: string,
    encryptedApiKey: string | null
  ): Promise<void> {
    this.savedUserKeys.set(userId, encryptedApiKey);
  }
}

describe("ApiRotationPool Rotation and Error Logic", () => {
  let keyRepo: MockApiKeyRepository;
  let rotationPool: ApiRotationPool;

  beforeEach(() => {
    keyRepo = new MockApiKeyRepository();
    rotationPool = createApiRotationPool({
      keyRepo,
      analysisModels: ["model-analysis-1", "model-analysis-2"],
      fastModels: ["model-fast-1", "model-fast-2"],
    });
  });

  it("should return the result and resolved model on success", async () => {
    keyRepo.systemKeys.push({
      id: "key-1",
      name: "Key 1",
      encryptedKey: "secret-1",
      status: "active",
      rateLimitedAt: null,
    });

    const executeSpy = vi.fn().mockResolvedValue("parsed-data");

    const { result, resolvedModel } = await rotationPool.executeWithRotation({
      userId: "user-123",
      modelKind: "fast",
      purpose: "grading",
      execute: executeSpy,
    });

    expect(result).toBe("parsed-data");
    expect(resolvedModel).toBe("model-fast-1");
    expect(executeSpy).toHaveBeenCalledWith({
      key: "secret-1",
      model: "model-fast-1",
      keyId: "key-1",
      isUserKey: false,
    });
    expect(
      keyRepo.updatedKeys.some(
        (k) => k.keyId === "key-1" && k.status === "active"
      )
    ).toBe(true);
  });

  it("should mark key rate-limited and rotate to next key on rate-limit error", async () => {
    keyRepo.systemKeys.push({
      id: "key-1",
      name: "Key 1",
      encryptedKey: "secret-1",
      status: "active",
      rateLimitedAt: null,
    });
    keyRepo.systemKeys.push({
      id: "key-2",
      name: "Key 2",
      encryptedKey: "secret-2",
      status: "active",
      rateLimitedAt: null,
    });

    // First call throws 429 rate limit
    const err429: any = new Error("RESOURCE_EXHAUSTED");
    err429.status = 429;

    const executeSpy = vi
      .fn()
      .mockRejectedValueOnce(err429)
      .mockResolvedValueOnce("success-data");

    const { result } = await rotationPool.executeWithRotation({
      userId: "user-123",
      modelKind: "fast",
      purpose: "grading",
      execute: executeSpy,
    });

    const firstTriedKeyId = executeSpy.mock.calls[0][0].keyId;
    const otherKeyId = firstTriedKeyId === "key-1" ? "key-2" : "key-1";

    expect(result).toBe("success-data");
    expect(
      rotationPool.isKeyModelCooldown(firstTriedKeyId, "model-fast-1")
    ).toBe(true);
    expect(rotationPool.isKeyModelCooldown(otherKeyId, "model-fast-1")).toBe(
      false
    );
    expect(
      keyRepo.updatedKeys.some(
        (k) => k.keyId === otherKeyId && k.status === "active"
      )
    ).toBe(true);
  });

  it("should mark key invalid and rotate to next key on invalid key error", async () => {
    keyRepo.systemKeys.push({
      id: "key-1",
      name: "Key 1",
      encryptedKey: "secret-1",
      status: "active",
      rateLimitedAt: null,
    });
    keyRepo.systemKeys.push({
      id: "key-2",
      name: "Key 2",
      encryptedKey: "secret-2",
      status: "active",
      rateLimitedAt: null,
    });

    const err400: any = new Error("API_KEY_INVALID");
    err400.status = 400;

    const executeSpy = vi
      .fn()
      .mockRejectedValueOnce(err400)
      .mockResolvedValueOnce("success-data");

    const { result } = await rotationPool.executeWithRotation({
      userId: "user-123",
      modelKind: "fast",
      purpose: "grading",
      execute: executeSpy,
    });

    const firstTriedKeyId = executeSpy.mock.calls[0][0].keyId;
    const otherKeyId = firstTriedKeyId === "key-1" ? "key-2" : "key-1";

    expect(result).toBe("success-data");
    expect(
      keyRepo.updatedKeys.some(
        (k) => k.keyId === firstTriedKeyId && k.status === "invalid"
      )
    ).toBe(true);
    expect(
      keyRepo.updatedKeys.some(
        (k) => k.keyId === otherKeyId && k.status === "invalid"
      )
    ).toBe(false);
  });

  it("should not mark key rate-limited or invalid on LlmValidationError, but still retry/rotate", async () => {
    keyRepo.systemKeys.push({
      id: "key-1",
      name: "Key 1",
      encryptedKey: "secret-1",
      status: "active",
      rateLimitedAt: null,
    });
    keyRepo.systemKeys.push({
      id: "key-2",
      name: "Key 2",
      encryptedKey: "secret-2",
      status: "active",
      rateLimitedAt: null,
    });

    const executeSpy = vi
      .fn()
      .mockRejectedValueOnce(new LlmValidationError("Zod parsing error"))
      .mockResolvedValueOnce("success-data");

    const { result } = await rotationPool.executeWithRotation({
      userId: "user-123",
      modelKind: "fast",
      purpose: "grading",
      execute: executeSpy,
    });

    expect(result).toBe("success-data");
    expect(
      keyRepo.updatedKeys.some(
        (k) => k.status === "rate_limited" || k.status === "invalid"
      )
    ).toBe(false);
  });

  it("should rotate models when all keys are exhausted", async () => {
    keyRepo.systemKeys.push({
      id: "key-1",
      name: "Key 1",
      encryptedKey: "secret-1",
      status: "active",
      rateLimitedAt: null,
    });

    const err429: any = new Error("RESOURCE_EXHAUSTED");
    err429.status = 429;

    const executeSpy = vi
      .fn()
      .mockRejectedValueOnce(err429) // model-fast-1 tries key-1 -> fails
      .mockResolvedValueOnce("model-2-success"); // model-fast-2 succeeds on key-1

    const { result, resolvedModel } = await rotationPool.executeWithRotation({
      userId: "user-123",
      modelKind: "fast",
      purpose: "grading",
      execute: executeSpy,
    });

    expect(result).toBe("model-2-success");
    expect(resolvedModel).toBe("model-fast-2");
    expect(rotationPool.isKeyModelCooldown("key-1", "model-fast-1")).toBe(true);
  });

  it("should filter out non-Gemini models when hasSchema is true", async () => {
    keyRepo.systemKeys.push({
      id: "key-1",
      name: "Key 1",
      encryptedKey: "secret-1",
      status: "active",
      rateLimitedAt: null,
    });
    const customPool = createApiRotationPool({
      keyRepo,
      analysisModels: [
        "gemini-analysis-1",
        "gemma-analysis-2",
        "gemini-analysis-3",
      ],
      fastModels: ["gemma-fast-1", "gemini-fast-2"],
    });

    const executeSpy = vi.fn().mockResolvedValue("parsed-data");

    const { result, resolvedModel } = await customPool.executeWithRotation({
      userId: "user-123",
      modelKind: "fast",
      purpose: "grading",
      hasSchema: true,
      execute: executeSpy,
    });

    expect(result).toBe("parsed-data");
    expect(resolvedModel).toBe("gemini-fast-2");
    expect(executeSpy).toHaveBeenCalledWith({
      key: "secret-1",
      model: "gemini-fast-2",
      keyId: "key-1",
      isUserKey: false,
    });
  });
});

describe("ApiRotationPool Unit Logic", () => {
  let pool: ApiRotationPool;

  beforeEach(() => {
    pool = createApiRotationPool({
      keyRepo: undefined,
      analysisModels: ["model-a", "model-b", "model-c"],
      fastModels: ["fast-a", "fast-b"],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getModels", () => {
    it("returns analysis models", () => {
      expect(pool.getModels("analysis")).toEqual([
        "model-a",
        "model-b",
        "model-c",
      ]);
    });

    it("returns fast models", () => {
      expect(pool.getModels("fast")).toEqual(["fast-a", "fast-b"]);
    });
  });

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
      const result = pool.getNextAvailable("analysis");
      expect(["model-a", "model-b", "model-c"]).toContain(result);
    });

    it("returns first model even when all are excluded (last resort)", () => {
      const excluded = new Set(["model-a", "model-b", "model-c"]);
      const result = pool.getNextAvailable("analysis", excluded);
      expect(result).toBe("model-a");
    });

    it("respects cooldown recovery after 30 seconds", () => {
      vi.useFakeTimers();
      pool.markRateLimited("model-a");
      expect(pool.getNextAvailable("analysis")).toBe("model-b");

      vi.advanceTimersByTime(30_001);
      expect(pool.getNextAvailable("analysis")).toBe("model-a");
    });

    it("filters out non-Gemini models if hasSchema is true", () => {
      const customPool = createApiRotationPool({
        keyRepo: undefined,
        analysisModels: ["gemini-1.5-pro", "gemma-2b", "gemini-2.0-flash"],
        fastModels: ["gemma-7b", "gemini-1.5-flash"],
      });
      expect(customPool.getNextAvailable("analysis", undefined, true)).toBe(
        "gemini-1.5-pro"
      );
      expect(
        customPool.getNextAvailable(
          "analysis",
          new Set(["gemini-1.5-pro"]),
          true
        )
      ).toBe("gemini-2.0-flash");
      expect(customPool.getNextAvailable("fast", undefined, true)).toBe(
        "gemini-1.5-flash"
      );
    });
  });

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

  describe("getThinkingLevel (Gemma compatibility)", () => {
    const GEMMA_MODELS = ["gemma-4-31b-it", "gemma-4-26b-a4b-it"];
    const NON_GEMMA_MODELS = [
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash",
      "gemini-3-flash-preview",
    ];

    let gemmaPool: ApiRotationPool;
    beforeEach(() => {
      gemmaPool = createApiRotationPool({
        keyRepo: undefined,
        analysisModels: [
          "gemma-4-31b-it",
          "gemma-4-26b-a4b-it",
          "gemini-3.1-flash-lite",
        ],
        fastModels: ["gemini-3.1-flash-lite"],
      });
    });

    it.each(GEMMA_MODELS)("maps LOW → MINIMAL for %s", (model) => {
      expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.LOW)).toBe(
        ThinkingLevel.MINIMAL
      );
    });

    it.each(GEMMA_MODELS)("maps MEDIUM → MINIMAL for %s", (model) => {
      expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.MEDIUM)).toBe(
        ThinkingLevel.MINIMAL
      );
    });

    it.each(GEMMA_MODELS)("preserves MINIMAL for %s", (model) => {
      expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.MINIMAL)).toBe(
        ThinkingLevel.MINIMAL
      );
    });

    it.each(GEMMA_MODELS)("preserves HIGH for %s", (model) => {
      expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.HIGH)).toBe(
        ThinkingLevel.HIGH
      );
    });

    it.each(NON_GEMMA_MODELS)(
      "passes through any level unchanged for non-Gemma %s",
      (model) => {
        expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.LOW)).toBe(
          ThinkingLevel.LOW
        );
        expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.MEDIUM)).toBe(
          ThinkingLevel.MEDIUM
        );
        expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.HIGH)).toBe(
          ThinkingLevel.HIGH
        );
        expect(gemmaPool.getThinkingLevel(model, ThinkingLevel.MINIMAL)).toBe(
          ThinkingLevel.MINIMAL
        );
      }
    );
  });

  describe("env var override", () => {
    it("uses GEMINI_ANALYSIS_MODELS env var when set", () => {
      const originalEnv = process.env.GEMINI_ANALYSIS_MODELS;
      process.env.GEMINI_ANALYSIS_MODELS = "custom-model-1,custom-model-2";
      try {
        const envPool = createApiRotationPool();
        expect(envPool.getModels("analysis")).toEqual([
          "custom-model-1",
          "custom-model-2",
        ]);
      } finally {
        process.env.GEMINI_ANALYSIS_MODELS = originalEnv;
      }
    });

    it("uses GEMINI_FAST_MODELS env var when set", () => {
      const originalEnv = process.env.GEMINI_FAST_MODELS;
      process.env.GEMINI_FAST_MODELS = "fast-custom-1";
      try {
        const envPool = createApiRotationPool();
        expect(envPool.getModels("fast")).toEqual(["fast-custom-1"]);
      } finally {
        process.env.GEMINI_FAST_MODELS = originalEnv;
      }
    });

    it("falls back to defaults when env var is empty string", () => {
      const originalEnv = process.env.GEMINI_ANALYSIS_MODELS;
      process.env.GEMINI_ANALYSIS_MODELS = "";
      try {
        const envPool = createApiRotationPool();
        expect(envPool.getModels("analysis")[0]).toBe("gemini-3.1-flash-lite");
      } finally {
        process.env.GEMINI_ANALYSIS_MODELS = originalEnv;
      }
    });

    it("trims whitespace from model names in env var", () => {
      const originalEnv = process.env.GEMINI_ANALYSIS_MODELS;
      process.env.GEMINI_ANALYSIS_MODELS = " model-x , model-y ";
      try {
        const envPool = createApiRotationPool();
        expect(envPool.getModels("analysis")).toEqual(["model-x", "model-y"]);
      } finally {
        process.env.GEMINI_ANALYSIS_MODELS = originalEnv;
      }
    });

    it("respects GEMINI_COOLDOWN_MS env var when set", () => {
      const originalCooldown = process.env.GEMINI_COOLDOWN_MS;
      process.env.GEMINI_COOLDOWN_MS = "15000";
      try {
        vi.useFakeTimers();
        const testPool = createApiRotationPool({
          keyRepo: undefined,
          analysisModels: ["model-a"],
          fastModels: [],
        });
        testPool.markRateLimited("model-a");
        expect(testPool.isAvailable("model-a")).toBe(false);

        vi.advanceTimersByTime(15001);
        expect(testPool.isAvailable("model-a")).toBe(true);
      } finally {
        process.env.GEMINI_COOLDOWN_MS = originalCooldown;
      }
    });
  });
});
