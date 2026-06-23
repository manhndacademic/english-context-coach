import { describe, expect, it, vi, beforeEach } from "vitest";
import { DrizzleApiKeyRepository } from "./legacy-api-key-repository";

function makeSchemaProxy(): any {
  const cache = new Map<string | symbol, any>();
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (!cache.has(prop)) {
        cache.set(prop, new Proxy({}, handler));
      }
      return cache.get(prop);
    },
  };
  return new Proxy({}, handler);
}

vi.mock("@/db", () => ({
  db: {},
  schema: makeSchemaProxy(),
}));

function mockChain(result: any) {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    set: () => chain,
    values: () => chain,
    returning: () => chain,
    update: () => chain,
    then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled),
  };
  return chain;
}

describe("DrizzleApiKeyRepository", () => {
  let mockDbClient: any;
  let repository: DrizzleApiKeyRepository;

  beforeEach(() => {
    mockDbClient = {
      select: vi.fn(),
      update: vi.fn(),
    };
    repository = new DrizzleApiKeyRepository();
  });

  describe("getSystemKeys", () => {
    it("returns system keys from DB", async () => {
      const mockRows = [
        {
          id: "sk-1",
          name: "Sys 1",
          encryptedKey: "enc_1",
          status: "active",
          rateLimitedAt: null,
        },
      ];
      mockDbClient.select.mockReturnValueOnce(mockChain(mockRows));
      const keys = await repository.getSystemKeys(mockDbClient);
      expect(keys).toEqual(mockRows);
    });
  });

  describe("getUserKeys", () => {
    it("returns user keys from DB for a given user", async () => {
      const mockRows = [
        {
          id: "uk-1",
          encryptedKey: "enc_uk_1",
          status: "active",
          rateLimitedAt: null,
        },
      ];
      mockDbClient.select.mockReturnValueOnce(mockChain(mockRows));
      const keys = await repository.getUserKeys("user-1", mockDbClient);
      expect(keys).toEqual(mockRows);
    });
  });

  describe("getLegacyUserKey", () => {
    it("returns user legacy custom api key", async () => {
      mockDbClient.select.mockReturnValueOnce(
        mockChain([{ customGeminiApiKey: "legacy_key" }])
      );
      const key = await repository.getLegacyUserKey("user-1", mockDbClient);
      expect(key).toBe("legacy_key");
    });

    it("returns null if user not found or legacy key null", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([]));
      const key = await repository.getLegacyUserKey("user-1", mockDbClient);
      expect(key).toBeNull();
    });
  });

  describe("updateKeyStatus", () => {
    it("updates user API key if matching row found", async () => {
      // update on userAiApiKeys succeeds and returns row
      mockDbClient.update.mockReturnValueOnce(mockChain([{ id: "key-1" }]));
      await repository.updateKeyStatus(
        "key-1",
        "rate_limited",
        "Rate Limit Error",
        mockDbClient
      );
      expect(mockDbClient.update).toHaveBeenCalledTimes(1);
    });

    it("falls back to system keys if user key update does not match any rows", async () => {
      // update on userAiApiKeys returns empty array (no rows matched)
      mockDbClient.update.mockReturnValueOnce(mockChain([]));
      // update on aiApiKeys called next
      mockDbClient.update.mockReturnValueOnce(mockChain([]));

      await repository.updateKeyStatus(
        "key-1",
        "invalid",
        "Invalid Key",
        mockDbClient
      );
      expect(mockDbClient.update).toHaveBeenCalledTimes(2);
    });
  });

  describe("saveUserApiKey", () => {
    it("saves custom key for user", async () => {
      mockDbClient.update.mockReturnValueOnce(mockChain([]));
      await repository.saveUserApiKey("user-1", "new_key", mockDbClient);
      expect(mockDbClient.update).toHaveBeenCalled();
    });
  });
});
