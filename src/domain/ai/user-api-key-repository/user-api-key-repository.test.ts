import { describe, expect, it, vi, beforeEach } from "vitest";
import { countUserKeys } from "./countUserKeys";
import { checkUserKeyDuplicate } from "./checkUserKeyDuplicate";
import { findUserApiKeyById } from "./findUserApiKeyById";
import { addUserApiKey } from "./addUserApiKey";
import { deleteUserApiKey } from "./deleteUserApiKey";
import { disableUserApiKey } from "./disableUserApiKey";
import { enableUserApiKey } from "./enableUserApiKey";
import { reverifyUserApiKey } from "./reverifyUserApiKey";
import { MAX_USER_KEYS } from "./constants";

// Setup mocks
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

vi.mock("@/lib/crypto", () => ({
  encryptApiKey: (key: string) => `enc_${key}`,
  decryptApiKey: (enc: string) => enc.replace("enc_", ""),
  sha256: (str: string) => `hash_${str}`,
}));

const mockVerifyGeminiApiKey = vi.fn();
vi.mock("../adapters/geminiUtils", () => ({
  verifyGeminiApiKey: (key: string) => mockVerifyGeminiApiKey(key),
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
    delete: () => chain,
    update: () => chain,
    insert: () => chain,
    then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled),
  };
  return chain;
}

describe("user-api-key-repository functions", () => {
  let mockDbClient: any;

  beforeEach(() => {
    mockVerifyGeminiApiKey.mockReset();
    mockDbClient = {
      select: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
    };
  });

  describe("countUserKeys", () => {
    it("returns key count", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([{ value: 3 }]));
      const count = await countUserKeys("user-1", mockDbClient);
      expect(count).toBe(3);
    });
  });

  describe("checkUserKeyDuplicate", () => {
    it("returns true if key duplicate exists", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([{ id: "uk-1" }]));
      const isDuplicate = await checkUserKeyDuplicate(
        "user-1",
        "fingerprint-1",
        mockDbClient
      );
      expect(isDuplicate).toBe(true);
    });

    it("returns false if no duplicate exists", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([]));
      const isDuplicate = await checkUserKeyDuplicate(
        "user-1",
        "fingerprint-1",
        mockDbClient
      );
      expect(isDuplicate).toBe(false);
    });
  });

  describe("findUserApiKeyById", () => {
    it("returns key row when found", async () => {
      const mockRow = { id: "uk-1", userId: "user-1", encryptedKey: "enc_key" };
      mockDbClient.select.mockReturnValueOnce(mockChain([mockRow]));
      const row = await findUserApiKeyById("user-1", "uk-1", mockDbClient);
      expect(row).toEqual(mockRow);
    });

    it("returns null when not found", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([]));
      const row = await findUserApiKeyById("user-1", "uk-1", mockDbClient);
      expect(row).toBeNull();
    });
  });

  describe("addUserApiKey", () => {
    it("fails if count exceeds max keys limit", async () => {
      mockDbClient.select.mockReturnValueOnce(
        mockChain([{ value: MAX_USER_KEYS }])
      );
      const result = await addUserApiKey(
        "user-1",
        { name: "Key 1", apiKey: "api-key-1", provider: "gemini" },
        mockDbClient
      );
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("tối đa");
      }
    });

    it("fails if fingerprint is a duplicate", async () => {
      // first call in validateAddKey: countUserKeys (success, 0 keys)
      mockDbClient.select.mockReturnValueOnce(mockChain([{ value: 0 }]));
      // second call in validateAddKey: checkUserKeyDuplicate (fails, true duplicate)
      mockDbClient.select.mockReturnValueOnce(
        mockChain([{ id: "existing-id" }])
      );

      const result = await addUserApiKey(
        "user-1",
        { name: "Key 1", apiKey: "api-key-1", provider: "gemini" },
        mockDbClient
      );
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("đã tồn tại");
      }
    });

    it("fails if API key verification fails", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([{ value: 0 }]));
      mockDbClient.select.mockReturnValueOnce(mockChain([]));
      mockVerifyGeminiApiKey.mockResolvedValueOnce("Invalid Key Error");

      const result = await addUserApiKey(
        "user-1",
        { name: "Key 1", apiKey: "invalid-key", provider: "gemini" },
        mockDbClient
      );
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("Xác thực API Key thất bại");
      }
    });

    it("inserts new key if validation succeeds", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([{ value: 0 }]));
      mockDbClient.select.mockReturnValueOnce(mockChain([]));
      mockVerifyGeminiApiKey.mockResolvedValueOnce(null);
      mockDbClient.insert.mockReturnValueOnce(mockChain([]));

      const result = await addUserApiKey(
        "user-1",
        { name: "Key 1", apiKey: "valid-key", provider: "gemini" },
        mockDbClient
      );
      expect(result.success).toBe(true);
      expect(mockDbClient.insert).toHaveBeenCalled();
    });
  });

  describe("deleteUserApiKey", () => {
    it("deletes key and returns success", async () => {
      mockDbClient.delete.mockReturnValueOnce(mockChain([{ id: "uk-1" }]));
      const result = await deleteUserApiKey("user-1", "uk-1", mockDbClient);
      expect(result.success).toBe(true);
    });

    it("returns error if no key deleted", async () => {
      mockDbClient.delete.mockReturnValueOnce(mockChain([]));
      const result = await deleteUserApiKey("user-1", "uk-1", mockDbClient);
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("Không tìm thấy");
      }
    });
  });

  describe("disableUserApiKey", () => {
    it("disables key status and returns success", async () => {
      mockDbClient.update.mockReturnValueOnce(mockChain([{ id: "uk-1" }]));
      const result = await disableUserApiKey("user-1", "uk-1", mockDbClient);
      expect(result.success).toBe(true);
    });

    it("returns error if no key updated", async () => {
      mockDbClient.update.mockReturnValueOnce(mockChain([]));
      const result = await disableUserApiKey("user-1", "uk-1", mockDbClient);
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("Không tìm thấy");
      }
    });
  });

  describe("enableUserApiKey", () => {
    it("returns error if key is not found", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([]));
      const result = await enableUserApiKey("user-1", "uk-1", mockDbClient);
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("Không tìm thấy");
      }
    });

    it("verifies and updates status to active on success", async () => {
      const mockRow = {
        id: "uk-1",
        userId: "user-1",
        encryptedKey: "enc_valid-key",
      };
      mockDbClient.select.mockReturnValueOnce(mockChain([mockRow]));
      mockVerifyGeminiApiKey.mockResolvedValueOnce(null);
      mockDbClient.update.mockReturnValueOnce(mockChain([]));

      const result = await enableUserApiKey("user-1", "uk-1", mockDbClient);
      expect(result.success).toBe(true);
      expect(mockDbClient.update).toHaveBeenCalled();
    });

    it("updates status to invalid on verification failure", async () => {
      const mockRow = {
        id: "uk-1",
        userId: "user-1",
        encryptedKey: "enc_invalid-key",
      };
      mockDbClient.select.mockReturnValueOnce(mockChain([mockRow]));
      mockVerifyGeminiApiKey.mockResolvedValueOnce("Failed verification");
      mockDbClient.update.mockReturnValueOnce(mockChain([]));

      const result = await enableUserApiKey("user-1", "uk-1", mockDbClient);
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("Không thể kích hoạt");
      }
    });
  });

  describe("reverifyUserApiKey", () => {
    it("returns error if key not found", async () => {
      mockDbClient.select.mockReturnValueOnce(mockChain([]));
      const result = await reverifyUserApiKey("user-1", "uk-1", mockDbClient);
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("Không tìm thấy");
      }
    });

    it("verifies key without enforcing success requirement", async () => {
      const mockRow = {
        id: "uk-1",
        userId: "user-1",
        encryptedKey: "enc_invalid-key",
      };
      mockDbClient.select.mockReturnValueOnce(mockChain([mockRow]));
      mockVerifyGeminiApiKey.mockResolvedValueOnce("Failed verification");
      mockDbClient.update.mockReturnValueOnce(mockChain([]));

      const result = await reverifyUserApiKey("user-1", "uk-1", mockDbClient);
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).not.toContain("Không thể kích hoạt");
        expect(result.error).toContain("Xác thực API Key thất bại");
      }
    });
  });
});
