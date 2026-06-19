import { describe, expect, it, vi } from "vitest";
import {
  verifyGeminiApiKey,
  extractJson,
  zodToGeminiSchema,
} from "./gemini-utils";
import { z } from "zod";

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

describe("extractJson", () => {
  it("extracts and parses simple json successfully", () => {
    const raw = `{"score": 90, "feedbackVi": "Tốt"}`;
    const result = JSON.parse(extractJson(raw));
    expect(result).toEqual({ score: 90, feedbackVi: "Tốt" });
  });

  it("handles literal newlines inside JSON string fields by escaping them", () => {
    const raw = `{"score": 90, "feedbackVi": "Dòng 1\nDòng 2"}`;
    const extracted = extractJson(raw);
    const parsed = JSON.parse(extracted);
    expect(parsed).toEqual({ score: 90, feedbackVi: "Dòng 1\nDòng 2" });
  });

  it("handles literal carriage returns inside JSON string fields by escaping them", () => {
    const raw = `{"score": 90, "feedbackVi": "Dòng 1\rDòng 2"}`;
    const extracted = extractJson(raw);
    const parsed = JSON.parse(extracted);
    expect(parsed).toEqual({ score: 90, feedbackVi: "Dòng 1\rDòng 2" });
  });

  it("leaves literal newlines outside JSON string fields untouched", () => {
    const raw = `{\n  "score": 90,\n  "feedbackVi": "Tốt"\n}`;
    const extracted = extractJson(raw);
    const parsed = JSON.parse(extracted);
    expect(parsed).toEqual({ score: 90, feedbackVi: "Tốt" });
  });

  it("handles nested braces and escaped quotes inside JSON string fields", () => {
    const raw = `{"score": 90, "feedbackVi": "Cấu trúc \\"{\\" và \\"}\\" là bắt buộc"}`;
    const extracted = extractJson(raw);
    const parsed = JSON.parse(extracted);
    expect(parsed).toEqual({
      score: 90,
      feedbackVi: 'Cấu trúc "{" và "}" là bắt buộc',
    });
  });
});

describe("zodToGeminiSchema", () => {
  it("translates simple string schema", () => {
    const schema = z.string();
    expect(zodToGeminiSchema(schema)).toEqual({ type: "STRING" });
  });

  it("translates nullable string schema", () => {
    const schema = z.string().nullable();
    expect(zodToGeminiSchema(schema)).toEqual({
      type: "STRING",
      nullable: true,
    });
  });

  it("translates refined optional nullable string schema (ZodEffects)", () => {
    const schema = z
      .string()
      .nullable()
      .optional()
      .refine((val) => !val || val.length > 3);
    expect(zodToGeminiSchema(schema)).toEqual({
      type: "STRING",
      nullable: true,
    });
  });

  it("translates object schemas, correctly marking required and optional fields", () => {
    const schema = z.object({
      requiredField: z.string(),
      optionalField: z.string().optional(),
      nullableField: z.string().nullable(),
      refinedField: z
        .string()
        .nullable()
        .optional()
        .refine((val) => !val || val.length > 5),
    });
    expect(zodToGeminiSchema(schema)).toEqual({
      type: "OBJECT",
      properties: {
        requiredField: { type: "STRING" },
        optionalField: { type: "STRING" },
        nullableField: { type: "STRING", nullable: true },
        refinedField: { type: "STRING", nullable: true },
      },
      required: ["requiredField"],
    });
  });

  it("translates default schemas", () => {
    const schema = z.string().default("test_val");
    expect(zodToGeminiSchema(schema)).toEqual({ type: "STRING" });
  });
});
