import { describe, expect, it, vi } from "vitest";
import {
  verifyGeminiApiKey,
  extractJson,
  inlineRefs,
  cleanSchemaForGemini,
  isInvalidKeyError,
  coerceJsonForSchema,
  getGeminiThinkingLevel,
} from "./geminiUtils";

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
    ThinkingLevel: {
      MINIMAL: "MINIMAL",
      LOW: "LOW",
      MEDIUM: "MEDIUM",
      HIGH: "HIGH",
    },
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

describe("inlineRefs", () => {
  it("resolves and inlines relative internal $ref paths", () => {
    const schema = {
      type: "object",
      properties: {
        detectedLevel: {
          type: "string",
          enum: ["A2", "B1", "B2"],
        },
        difficulty: {
          $ref: "#/properties/detectedLevel",
        },
      },
    };

    const resolved = inlineRefs(schema);
    expect(resolved.properties.difficulty).toEqual({
      type: "string",
      enum: ["A2", "B1", "B2"],
    });
  });
});

describe("cleanSchemaForGemini", () => {
  it("removes forbidden fields and converts const to enum", () => {
    const schema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        title: {
          type: "string",
          minLength: 1,
          maxLength: 80,
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                const: "grammar",
              },
            },
          },
          minItems: 1,
          maxItems: 5,
        },
      },
      additionalProperties: false,
    };

    const cleaned = cleanSchemaForGemini(schema);
    expect(cleaned).toEqual({
      type: "object",
      properties: {
        title: {
          type: "string",
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                enum: ["grammar"],
              },
            },
          },
        },
      },
    });
  });
});

describe("isInvalidKeyError", () => {
  it("returns true for actual invalid key errors", () => {
    const err = { message: "API key not valid", status: 400 };
    expect(isInvalidKeyError(err)).toBe(true);
  });

  it("returns false for request parameter invalid argument errors", () => {
    const err1 = {
      message: "Request contains an invalid argument.",
      status: 400,
    };
    expect(isInvalidKeyError(err1)).toBe(false);
  });
});

describe("AI provider JSON coercion", () => {
  it("wraps top-level exercise arrays in the expected object shape", () => {
    const input = [{ type: "meaning_choice", phrase: "push back" }];
    expect(coerceJsonForSchema(input, "exercises")).toEqual({
      exercises: input,
    });
  });

  it("unwraps single-object analysis arrays", () => {
    const input = [
      {
        title: "Lesson",
        textType: "work_message",
        detectedLevel: "B1",
        summaryVi: "Summary",
        naturalTranslationVi: "Translation",
        contextExplanationVi: "Context",
        keyPhrases: [],
      },
    ];
    expect(coerceJsonForSchema(input, "analysis")).toEqual(input[0]);
  });

  it("leaves multi-item non-exercise arrays unchanged", () => {
    const input = [{ title: "not valid analysis" }];
    expect(coerceJsonForSchema([input[0], input[0]], "analysis")).toEqual([
      input[0],
      input[0],
    ]);
  });

  it("removes null optional grading fields before schema validation", () => {
    expect(
      coerceJsonForSchema(
        {
          score: 80,
          isCorrect: false,
          feedbackVi: "Gần đúng.",
          errorType: null,
          explanationVi: "",
        },
        "grading"
      )
    ).toEqual({
      score: 80,
      isCorrect: false,
      feedbackVi: "Gần đúng.",
    });
  });

  it("recursively strips null values from nested structures for any schema", () => {
    const input = {
      title: "Nested Null Test",
      keyPhrases: [
        {
          phrase: "test",
          meaningVi: "thử nghiệm",
          whyConfusingVi: null,
        },
      ],
      sentenceBreakdowns: null,
    };
    expect(coerceJsonForSchema(input, "analysis")).toEqual({
      title: "Nested Null Test",
      keyPhrases: [
        {
          phrase: "test",
          meaningVi: "thử nghiệm",
        },
      ],
    });
  });

  it("normalizes supported Gemini thinking levels from the environment", () => {
    const original = process.env.GEMINI_THINKING_LEVEL;
    process.env.GEMINI_THINKING_LEVEL = "medium";
    expect(getGeminiThinkingLevel()).toBe("MEDIUM");

    process.env.GEMINI_THINKING_LEVEL = "unsupported";
    expect(getGeminiThinkingLevel()).toBe("MINIMAL");

    process.env.GEMINI_THINKING_LEVEL = original;
  });

  describe("extractJson extra cases", () => {
    it("extracts json inside markdown blocks", () => {
      const raw = '```json\n{"key": "value"}\n```';
      expect(JSON.parse(extractJson(raw))).toEqual({ key: "value" });
    });

    it("extracts json even with trailing garbage braces and brackets", () => {
      const raw = '{"key": "value"}}\n]\n}\n]';
      expect(JSON.parse(extractJson(raw))).toEqual({ key: "value" });
    });

    it("extracts complex nested json structure with trailing garbage", () => {
      const raw = '{"key": {"nested": [1, 2, 3]}, "flag": true}}\n]\n}\n]';
      expect(JSON.parse(extractJson(raw))).toEqual({
        key: { nested: [1, 2, 3] },
        flag: true,
      });
    });
  });
});
