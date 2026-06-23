import { describe, expect, it } from "vitest";
import { isDbKeyUsable } from "./db-key-validator";

describe("isDbKeyUsable", () => {
  const defaultOptions = {
    keyRepo: {} as any,
    isKeyModelCooldown: () => false,
    isEnvKeyCooldown: () => false,
    isEnvKeyInvalid: () => false,
  };

  it("should return true for a valid active key", () => {
    const key = { id: "k-1", status: "active", rateLimitedAt: null };
    expect(isDbKeyUsable(key, defaultOptions)).toBe(true);
  });

  it("should return false if the key status is invalid", () => {
    const key = { id: "k-1", status: "invalid", rateLimitedAt: null };
    expect(isDbKeyUsable(key, defaultOptions)).toBe(false);
  });

  it("should return false if the key is excluded", () => {
    const key = { id: "k-1", status: "active", rateLimitedAt: null };
    const options = {
      ...defaultOptions,
      excludedKeyIds: new Set(["k-1"]),
    };
    expect(isDbKeyUsable(key, options)).toBe(false);
  });

  it("should return false if the key is in model cooldown", () => {
    const key = { id: "k-1", status: "active", rateLimitedAt: null };
    const options = {
      ...defaultOptions,
      model: "gemini-3.5",
      isKeyModelCooldown: (keyId: string, model: string) =>
        keyId === "k-1" && model === "gemini-3.5",
    };
    expect(isDbKeyUsable(key, options)).toBe(false);
  });

  it("should return false if the key is rate-limited within the last 1 minute", () => {
    const now = Date.now();
    const key = {
      id: "k-1",
      status: "rate_limited",
      rateLimitedAt: new Date(now - 30 * 1000),
    };
    expect(isDbKeyUsable(key, defaultOptions, now)).toBe(false);
  });

  it("should return true if the key rate-limit period has expired", () => {
    const now = Date.now();
    const key = {
      id: "k-1",
      status: "rate_limited",
      rateLimitedAt: new Date(now - 90 * 1000),
    };
    expect(isDbKeyUsable(key, defaultOptions, now)).toBe(true);
  });
});
