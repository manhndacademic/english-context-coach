import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiRotationPool, LlmValidationError } from "./api-rotation-pool";
import type { ApiKeyRepository } from "../ports";

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
    rotationPool = new ApiRotationPool(
      keyRepo,
      ["model-analysis-1", "model-analysis-2"],
      ["model-fast-1", "model-fast-2"]
    );
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
    const customPool = new ApiRotationPool(
      keyRepo,
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
