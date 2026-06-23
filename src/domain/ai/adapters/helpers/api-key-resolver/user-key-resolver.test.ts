import { describe, expect, it, vi } from "vitest";
import { resolveUserKeys } from "./user-key-resolver";

vi.mock("@/lib/crypto", () => ({
  decryptApiKey: (key: string) => key,
}));

describe("resolveUserKeys", () => {
  const defaultOptions = {
    userId: "user-123",
    keyRepo: {
      getUserKeys: async () => [],
      getLegacyUserKey: async () => null,
    } as any,
    isKeyModelCooldown: () => false,
    isEnvKeyCooldown: () => false,
    isEnvKeyInvalid: () => false,
  };

  it("should return null if no userId is provided", async () => {
    const result = await resolveUserKeys({
      ...defaultOptions,
      userId: undefined,
    });
    expect(result).toBeNull();
  });

  it("should select active user key from DB", async () => {
    const keyRepo = {
      getUserKeys: async () => [
        {
          id: "uk-1",
          encryptedKey: "secret-key",
          status: "active",
          rateLimitedAt: null,
        },
      ],
      getLegacyUserKey: async () => null,
    };
    const result = await resolveUserKeys({
      ...defaultOptions,
      keyRepo: keyRepo as any,
    });
    expect(result).toEqual({
      key: "secret-key",
      id: "uk-1",
      isUserKey: true,
    });
  });

  it("should fallback to legacy keys if DB has no keys", async () => {
    const keyRepo = {
      getUserKeys: async () => [],
      getLegacyUserKey: async () => "legacy-key-secret",
    };
    const result = await resolveUserKeys({
      ...defaultOptions,
      keyRepo: keyRepo as any,
    });
    expect(result).toEqual({
      key: "legacy-key-secret",
      id: "user-key-0",
      isUserKey: true,
    });
  });

  it("should parse legacy JSON array key", async () => {
    const keyRepo = {
      getUserKeys: async () => [],
      getLegacyUserKey: async () => '["legacy-1", "legacy-2"]',
    };
    const result = await resolveUserKeys({
      ...defaultOptions,
      keyRepo: keyRepo as any,
      excludedKeyIds: new Set(["user-key-0"]), // Exclude the first one, should pick the second
    });
    expect(result).toEqual({
      key: "legacy-2",
      id: "user-key-1",
      isUserKey: true,
    });
  });
});
