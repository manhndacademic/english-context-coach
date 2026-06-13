import { describe, expect, it } from "vitest";
import { encryptApiKey, decryptApiKey } from "./crypto";

describe("Crypto AES-256-GCM Encryption Helpers", () => {
  it("should encrypt and decrypt correctly when ENCRYPTION_SECRET is set", () => {
    const originalSecret = process.env.ENCRYPTION_SECRET;
    process.env.ENCRYPTION_SECRET = "super-secret-random-key-for-testing-123456";

    const testApiKey = "AIzaSyTestApiKey123456789";
    const encrypted = encryptApiKey(testApiKey);
    expect(encrypted).toContain(":");
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(testApiKey);

    process.env.ENCRYPTION_SECRET = originalSecret;
  });

  it("should throw error if ENCRYPTION_SECRET is missing", () => {
    const originalSecret = process.env.ENCRYPTION_SECRET;
    delete process.env.ENCRYPTION_SECRET;

    expect(() => encryptApiKey("test")).toThrow("ENCRYPTION_SECRET environment variable is missing.");

    process.env.ENCRYPTION_SECRET = originalSecret;
  });
});
