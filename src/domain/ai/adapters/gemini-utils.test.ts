import { describe, expect, it, vi } from "vitest";
import { verifyGeminiApiKey } from "./gemini-utils";

// Mock GoogleGenAI
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation((config) => {
      return {
        models: {
          generateContent: vi.fn().mockImplementation(() => {
            if (config.apiKey === "valid-key") {
              return { text: "OK" };
            }
            if (config.apiKey === "invalid-key") {
              const err: any = new Error("API key not valid");
              err.status = 400;
              throw err;
            }
            if (config.apiKey === "rate-limited-key") {
              const err: any = new Error("RESOURCE_EXHAUSTED");
              err.status = 429;
              throw err;
            }
            if (config.apiKey === "network-error-key") {
              throw new Error("fetch failed");
            }
            throw new Error("Unknown error");
          }),
        },
      };
    }),
  };
});

describe("verifyGeminiApiKey", () => {
  it("resolves to null for a valid key", async () => {
    const error = await verifyGeminiApiKey("valid-key");
    expect(error).toBeNull();
  });

  it("sanitizes invalid key errors into a user-friendly Vietnamese message", async () => {
    const error = await verifyGeminiApiKey("invalid-key");
    expect(error).toContain(
      "API Key không hợp lệ hoặc không có quyền truy cập"
    );
  });

  it("sanitizes rate limit/quota errors into a user-friendly Vietnamese message", async () => {
    const error = await verifyGeminiApiKey("rate-limited-key");
    expect(error).toContain("Tài khoản Gemini đã hết hạn ngạch");
  });

  it("sanitizes network errors into a user-friendly Vietnamese message", async () => {
    const error = await verifyGeminiApiKey("network-error-key");
    expect(error).toContain("Không thể kết nối đến máy chủ Gemini");
  });
});
