import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolveApiKey } from "./resolveApiKey";
import type { ApiKeyRepository } from "../../../ports";

vi.mock("@/lib/crypto", () => ({
  decryptApiKey: (key: string) => key,
}));

class MockApiKeyRepository implements ApiKeyRepository {
  systemKeys: any[] = [];
  userKeys: any[] = [];
  legacyKey: string | null = null;

  async getSystemKeys() {
    return this.systemKeys;
  }
  async getUserKeys(_userId: string) {
    return this.userKeys;
  }
  async getLegacyUserKey(_userId: string) {
    return this.legacyKey;
  }
  async updateKeyStatus() {}
  async saveUserApiKey() {}
}

describe("resolveApiKey integration", () => {
  let keyRepo: MockApiKeyRepository;

  beforeEach(() => {
    keyRepo = new MockApiKeyRepository();
    // Clean environment variables
    delete process.env.GEMINI_API_KEYS;
    delete process.env.GEMINI_API_KEY;
  });

  it("should prefer user keys over system and env keys", async () => {
    keyRepo.userKeys = [
      {
        id: "uk-1",
        encryptedKey: "user-key-secret",
        status: "active",
        rateLimitedAt: null,
      },
    ];
    keyRepo.systemKeys = [
      {
        id: "sk-1",
        name: "Sys 1",
        encryptedKey: "system-key-secret",
        status: "active",
        rateLimitedAt: null,
      },
    ];
    process.env.GEMINI_API_KEYS = "env-key-secret";

    const result = await resolveApiKey({
      keyRepo,
      userId: "user-123",
      isKeyModelCooldown: () => false,
      isEnvKeyCooldown: () => false,
      isEnvKeyInvalid: () => false,
    });

    expect(result).toEqual({
      key: "user-key-secret",
      id: "uk-1",
      isUserKey: true,
    });
  });

  it("should select active system key if user has no keys", async () => {
    keyRepo.systemKeys = [
      {
        id: "sk-1",
        name: "Sys 1",
        encryptedKey: "system-key-secret",
        status: "active",
        rateLimitedAt: null,
      },
    ];
    process.env.GEMINI_API_KEYS = "env-key-secret";

    const result = await resolveApiKey({
      keyRepo,
      userId: "user-123",
      isKeyModelCooldown: () => false,
      isEnvKeyCooldown: () => false,
      isEnvKeyInvalid: () => false,
    });

    expect(result).toEqual({
      key: "system-key-secret",
      id: "sk-1",
      isUserKey: false,
    });
  });

  it("should fallback to env keys if no DB keys exist", async () => {
    process.env.GEMINI_API_KEYS = "env-key-secret";

    const result = await resolveApiKey({
      keyRepo,
      userId: "user-123",
      isKeyModelCooldown: () => false,
      isEnvKeyCooldown: () => false,
      isEnvKeyInvalid: () => false,
    });

    expect(result).toEqual({
      key: "env-key-secret",
      id: "env-key-0",
      isUserKey: false,
    });
  });

  it("should respect excludedKeyIds", async () => {
    keyRepo.systemKeys = [
      {
        id: "sk-1",
        name: "Sys 1",
        encryptedKey: "system-key-secret",
        status: "active",
        rateLimitedAt: null,
      },
      {
        id: "sk-2",
        name: "Sys 2",
        encryptedKey: "system-key-2",
        status: "active",
        rateLimitedAt: null,
      },
    ];

    const result = await resolveApiKey({
      keyRepo,
      userId: "user-123",
      excludedKeyIds: new Set(["sk-1"]),
      isKeyModelCooldown: () => false,
      isEnvKeyCooldown: () => false,
      isEnvKeyInvalid: () => false,
    });

    expect(result.id).toBe("sk-2");
  });

  it("should respect model cooldowns", async () => {
    keyRepo.systemKeys = [
      {
        id: "sk-1",
        name: "Sys 1",
        encryptedKey: "system-key-secret",
        status: "active",
        rateLimitedAt: null,
      },
      {
        id: "sk-2",
        name: "Sys 2",
        encryptedKey: "system-key-2",
        status: "active",
        rateLimitedAt: null,
      },
    ];

    const result = await resolveApiKey({
      keyRepo,
      userId: "user-123",
      model: "gemini-3.5-flash",
      isKeyModelCooldown: (keyId) => keyId === "sk-1",
      isEnvKeyCooldown: () => false,
      isEnvKeyInvalid: () => false,
    });

    expect(result.id).toBe("sk-2");
  });
});
