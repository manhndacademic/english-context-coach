import { describe, expect, it, vi, beforeEach } from "vitest";
import { AddUserApiKeyService, MAX_USER_KEYS } from "./add-user-api-key";
import { DeleteUserApiKeyService } from "./delete-user-api-key";
import { DisableUserApiKeyService } from "./disable-user-api-key";
import { EnableUserApiKeyService } from "./enable-user-api-key";
import { ReverifyUserApiKeyService } from "./reverify-user-api-key";
import type { UserApiKeyRepository } from "../ports/user-api-key-repository";
import type { ApiKeyVerifier } from "../ports/api-key-verifier";

vi.mock("@/lib/crypto", () => ({
  encryptApiKey: (key: string) => `enc_${key}`,
  decryptApiKey: (enc: string) => enc.replace("enc_", ""),
  sha256: (str: string) => `hash_${str}`,
}));

describe("User API Key Use Cases", () => {
  let mockRepo: UserApiKeyRepository;
  let fakeVerifier: ApiKeyVerifier;
  let addUserApiKeyUC: AddUserApiKeyService;
  let deleteUserApiKeyUC: DeleteUserApiKeyService;
  let disableUserApiKeyUC: DisableUserApiKeyService;
  let enableUserApiKeyUC: EnableUserApiKeyService;
  let reverifyUserApiKeyUC: ReverifyUserApiKeyService;

  beforeEach(() => {
    mockRepo = {
      add: vi.fn(),
      delete: vi.fn(),
      updateStatus: vi.fn(),
      findById: vi.fn(),
      countForUser: vi.fn(),
      checkDuplicate: vi.fn(),
    };

    fakeVerifier = { verify: vi.fn() };

    addUserApiKeyUC = new AddUserApiKeyService(mockRepo, fakeVerifier);
    deleteUserApiKeyUC = new DeleteUserApiKeyService(mockRepo);
    disableUserApiKeyUC = new DisableUserApiKeyService(mockRepo);
    enableUserApiKeyUC = new EnableUserApiKeyService(mockRepo, fakeVerifier);
    reverifyUserApiKeyUC = new ReverifyUserApiKeyService(
      mockRepo,
      fakeVerifier
    );
  });

  describe("addUserApiKey", () => {
    it("fails if count exceeds max keys limit", async () => {
      vi.mocked(mockRepo.countForUser).mockResolvedValue(MAX_USER_KEYS);
      const result = await addUserApiKeyUC.execute("user-1", {
        name: "Key 1",
        apiKey: "api-key-1",
        provider: "gemini",
      });
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("tối đa");
      }
    });

    it("fails if fingerprint is a duplicate", async () => {
      vi.mocked(mockRepo.countForUser).mockResolvedValue(0);
      vi.mocked(mockRepo.checkDuplicate).mockResolvedValue(true);

      const result = await addUserApiKeyUC.execute("user-1", {
        name: "Key 1",
        apiKey: "api-key-1",
        provider: "gemini",
      });
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("đã tồn tại");
      }
    });

    it("fails if API key verification fails", async () => {
      vi.mocked(mockRepo.countForUser).mockResolvedValue(0);
      vi.mocked(mockRepo.checkDuplicate).mockResolvedValue(false);
      vi.mocked(fakeVerifier.verify).mockResolvedValueOnce("Invalid Key Error");

      const result = await addUserApiKeyUC.execute("user-1", {
        name: "Key 1",
        apiKey: "invalid-key",
        provider: "gemini",
      });
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("Xác thực API Key thất bại");
      }
    });

    it("inserts new key if validation succeeds", async () => {
      vi.mocked(mockRepo.countForUser).mockResolvedValue(0);
      vi.mocked(mockRepo.checkDuplicate).mockResolvedValue(false);
      vi.mocked(fakeVerifier.verify).mockResolvedValueOnce(null);

      const result = await addUserApiKeyUC.execute("user-1", {
        name: "Key 1",
        apiKey: "valid-key",
        provider: "gemini",
      });
      expect(result.success).toBe(true);
      expect(mockRepo.add).toHaveBeenCalledWith(
        "user-1",
        "Key 1",
        "enc_valid-key",
        "hash_gemini:valid-key"
      );
    });

    it("passes the raw (unencrypted) key to the verifier", async () => {
      vi.mocked(mockRepo.countForUser).mockResolvedValue(0);
      vi.mocked(mockRepo.checkDuplicate).mockResolvedValue(false);
      vi.mocked(fakeVerifier.verify).mockResolvedValueOnce(null);

      await addUserApiKeyUC.execute("user-1", {
        name: "Key 1",
        apiKey: "raw-key-value",
        provider: "gemini",
      });
      expect(fakeVerifier.verify).toHaveBeenCalledWith("raw-key-value");
    });
  });

  describe("deleteUserApiKey", () => {
    it("deletes key and returns success", async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue({
        id: "uk-1",
        userId: "user-1",
        provider: "gemini",
        name: "Key 1",
        encryptedKey: "enc_key",
        keyFingerprint: "hash_key",
        status: "active",
        rateLimitedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await deleteUserApiKeyUC.execute("user-1", "uk-1");
      expect(result.success).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith("user-1", "uk-1");
    });

    it("returns error if no key found", async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue(null);
      const result = await deleteUserApiKeyUC.execute("user-1", "uk-1");
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("Không tìm thấy");
      }
    });
  });

  describe("disableUserApiKey", () => {
    it("disables key status and returns success", async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue({
        id: "uk-1",
        userId: "user-1",
        provider: "gemini",
        name: "Key 1",
        encryptedKey: "enc_key",
        keyFingerprint: "hash_key",
        status: "active",
        rateLimitedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await disableUserApiKeyUC.execute("user-1", "uk-1");
      expect(result.success).toBe(true);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        "uk-1",
        "disabled",
        null
      );
    });

    it("returns error if no key found", async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue(null);
      const result = await disableUserApiKeyUC.execute("user-1", "uk-1");
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("Không tìm thấy");
      }
    });
  });

  describe("enableUserApiKey", () => {
    it("returns error if key is not found", async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue(null);
      const result = await enableUserApiKeyUC.execute("user-1", "uk-1");
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("Không tìm thấy");
      }
    });

    it("verifies and updates status to active on success", async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue({
        id: "uk-1",
        userId: "user-1",
        provider: "gemini",
        name: "Key 1",
        encryptedKey: "enc_valid-key",
        keyFingerprint: "hash_key",
        status: "disabled",
        rateLimitedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(fakeVerifier.verify).mockResolvedValueOnce(null);

      const result = await enableUserApiKeyUC.execute("user-1", "uk-1");
      expect(result.success).toBe(true);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        "uk-1",
        "active",
        null
      );
    });

    it("updates status to invalid on verification failure", async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue({
        id: "uk-1",
        userId: "user-1",
        provider: "gemini",
        name: "Key 1",
        encryptedKey: "enc_invalid-key",
        keyFingerprint: "hash_key",
        status: "disabled",
        rateLimitedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(fakeVerifier.verify).mockResolvedValueOnce(
        "Failed verification"
      );

      const result = await enableUserApiKeyUC.execute("user-1", "uk-1");
      expect(result.success).toBe(false);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        "uk-1",
        "invalid",
        "Failed verification"
      );
      if (result.success === false) {
        expect(result.error).toContain("Không thể kích hoạt");
      }
    });

    it("passes the decrypted key to the verifier", async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue({
        id: "uk-1",
        userId: "user-1",
        provider: "gemini",
        name: "Key 1",
        encryptedKey: "enc_my-secret-key",
        keyFingerprint: "hash_key",
        status: "disabled",
        rateLimitedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(fakeVerifier.verify).mockResolvedValueOnce(null);

      await enableUserApiKeyUC.execute("user-1", "uk-1");
      // decryptApiKey strips "enc_" prefix per the mock
      expect(fakeVerifier.verify).toHaveBeenCalledWith("my-secret-key");
    });
  });

  describe("reverifyUserApiKey", () => {
    it("returns error if key not found", async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue(null);
      const result = await reverifyUserApiKeyUC.execute("user-1", "uk-1");
      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain("Không tìm thấy");
      }
    });

    it("verifies key without enforcing success requirement", async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue({
        id: "uk-1",
        userId: "user-1",
        provider: "gemini",
        name: "Key 1",
        encryptedKey: "enc_invalid-key",
        keyFingerprint: "hash_key",
        status: "disabled",
        rateLimitedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(fakeVerifier.verify).mockResolvedValueOnce(
        "Failed verification"
      );

      const result = await reverifyUserApiKeyUC.execute("user-1", "uk-1");
      expect(result.success).toBe(false);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        "uk-1",
        "invalid",
        "Failed verification"
      );
      if (result.success === false) {
        expect(result.error).not.toContain("Không thể kích hoạt");
        expect(result.error).toContain("Xác thực API Key thất bại");
      }
    });

    it("passes the decrypted key to the verifier", async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue({
        id: "uk-1",
        userId: "user-1",
        provider: "gemini",
        name: "Key 1",
        encryptedKey: "enc_stored-key",
        keyFingerprint: "hash_key",
        status: "active",
        rateLimitedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(fakeVerifier.verify).mockResolvedValueOnce(null);

      await reverifyUserApiKeyUC.execute("user-1", "uk-1");
      expect(fakeVerifier.verify).toHaveBeenCalledWith("stored-key");
    });
  });
});
