import { describe, expect, it, beforeEach } from "vitest";
import { resolveEnvironmentKeys } from "./env-key-resolver";

describe("resolveEnvironmentKeys", () => {
  const defaultOptions = {
    keyRepo: {} as any,
    isKeyModelCooldown: () => false,
    isEnvKeyCooldown: () => false,
    isEnvKeyInvalid: () => false,
  };

  beforeEach(() => {
    delete process.env.GEMINI_API_KEYS;
    delete process.env.GEMINI_API_KEY;
  });

  it("should return null if no env variables are set", async () => {
    const result = await resolveEnvironmentKeys(defaultOptions);
    expect(result).toBeNull();
  });

  it("should select key from GEMINI_API_KEYS and map ID", async () => {
    process.env.GEMINI_API_KEYS = "env-secret-1";
    const result = await resolveEnvironmentKeys(defaultOptions);
    expect(result).toEqual({
      key: "env-secret-1",
      id: "env-key-0",
      isUserKey: false,
    });
  });

  it("should parse comma-separated GEMINI_API_KEYS", async () => {
    process.env.GEMINI_API_KEYS = "env-secret-1,env-secret-2";
    const result = await resolveEnvironmentKeys({
      ...defaultOptions,
      excludedKeyIds: new Set(["env-key-0"]),
    });
    expect(result).toEqual({
      key: "env-secret-2",
      id: "env-key-1",
      isUserKey: false,
    });
  });
});
