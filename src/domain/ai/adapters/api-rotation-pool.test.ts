import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiRotationPool, LlmValidationError } from "./api-rotation-pool";
import type { KeyResolver } from "../ports";

class MockKeyResolver implements KeyResolver {
  keys: { key: string; id: string; isUserKey: boolean }[] = [];
  rateLimitedKeys = new Set<string>();
  invalidKeys = new Set<string>();
  restoredKeys = new Set<string>();

  async resolveApiKeyWithExclusions(
    _userId?: string,
    excludedKeyIds?: Set<string>,
    _model?: string
  ) {
    const active = this.keys.filter((k) => !excludedKeyIds?.has(k.id));
    if (active.length === 0) {
      throw new Error("No keys available");
    }
    return active[0];
  }

  async markKeyRateLimited(keyId: string, _errorMsg: string, _model?: string) {
    this.rateLimitedKeys.add(keyId);
  }

  async markKeyInvalid(keyId: string, _errorMsg: string) {
    this.invalidKeys.add(keyId);
  }

  async restoreKeyToActive(keyId: string) {
    this.restoredKeys.add(keyId);
  }

  async saveUserApiKey(_userId: string, _encryptedApiKey: string | null) {}
}

describe("ApiRotationPool Rotation and Error Logic", () => {
  let keyResolver: MockKeyResolver;
  let rotationPool: ApiRotationPool;

  beforeEach(() => {
    keyResolver = new MockKeyResolver();
    rotationPool = new ApiRotationPool(
      keyResolver,
      ["model-analysis-1", "model-analysis-2"],
      ["model-fast-1", "model-fast-2"]
    );
  });

  it("should return the result and resolved model on success", async () => {
    keyResolver.keys.push({ key: "secret-1", id: "key-1", isUserKey: false });

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
    expect(keyResolver.restoredKeys.has("key-1")).toBe(true);
  });

  it("should mark key rate-limited and rotate to next key on rate-limit error", async () => {
    keyResolver.keys.push({ key: "secret-1", id: "key-1", isUserKey: false });
    keyResolver.keys.push({ key: "secret-2", id: "key-2", isUserKey: false });

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

    expect(result).toBe("success-data");
    expect(keyResolver.rateLimitedKeys.has("key-1")).toBe(true);
    expect(keyResolver.rateLimitedKeys.has("key-2")).toBe(false);
    expect(keyResolver.restoredKeys.has("key-2")).toBe(true);
  });

  it("should mark key invalid and rotate to next key on invalid key error", async () => {
    keyResolver.keys.push({ key: "secret-1", id: "key-1", isUserKey: false });
    keyResolver.keys.push({ key: "secret-2", id: "key-2", isUserKey: false });

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

    expect(result).toBe("success-data");
    expect(keyResolver.invalidKeys.has("key-1")).toBe(true);
    expect(keyResolver.invalidKeys.has("key-2")).toBe(false);
  });

  it("should not mark key rate-limited or invalid on LlmValidationError, but still retry/rotate", async () => {
    keyResolver.keys.push({ key: "secret-1", id: "key-1", isUserKey: false });
    keyResolver.keys.push({ key: "secret-2", id: "key-2", isUserKey: false });

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
    expect(keyResolver.rateLimitedKeys.size).toBe(0);
    expect(keyResolver.invalidKeys.size).toBe(0);
  });

  it("should rotate models when all keys are exhausted", async () => {
    keyResolver.keys.push({ key: "secret-1", id: "key-1", isUserKey: false });

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
    expect(keyResolver.rateLimitedKeys.has("key-1")).toBe(true);
  });

  it("should filter out non-Gemini models when hasSchema is true", async () => {
    keyResolver.keys.push({ key: "secret-1", id: "key-1", isUserKey: false });
    const customPool = new ApiRotationPool(
      keyResolver,
      ["gemini-analysis-1", "gemma-analysis-2", "gemini-analysis-3"],
      ["gemma-fast-1", "gemini-fast-2"]
    );

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
