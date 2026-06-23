import { describe, expect, it, vi } from "vitest";
import { resolveSystemKeys } from "./system-key-resolver";

vi.mock("@/lib/crypto", () => ({
  decryptApiKey: (key: string) => key,
}));

describe("resolveSystemKeys", () => {
  const defaultOptions = {
    keyRepo: {
      getSystemKeys: async () => [],
    } as any,
    isKeyModelCooldown: () => false,
    isEnvKeyCooldown: () => false,
    isEnvKeyInvalid: () => false,
  };

  it("should return null if no system keys exist", async () => {
    const result = await resolveSystemKeys(defaultOptions);
    expect(result).toBeNull();
  });

  it("should select system key from DB and decrypt it", async () => {
    const keyRepo = {
      getSystemKeys: async () => [
        {
          id: "sk-1",
          name: "Sys 1",
          encryptedKey: "system-key-secret",
          status: "active",
          rateLimitedAt: null,
        },
      ],
    };
    const result = await resolveSystemKeys({
      ...defaultOptions,
      keyRepo: keyRepo as any,
    });
    expect(result).toEqual({
      key: "system-key-secret",
      id: "sk-1",
      isUserKey: false,
    });
  });

  it("should filter out invalid system keys", async () => {
    const keyRepo = {
      getSystemKeys: async () => [
        {
          id: "sk-1",
          name: "Sys 1",
          encryptedKey: "system-key-secret",
          status: "invalid",
          rateLimitedAt: null,
        },
      ],
    };
    const result = await resolveSystemKeys({
      ...defaultOptions,
      keyRepo: keyRepo as any,
    });
    expect(result).toBeNull();
  });
});
