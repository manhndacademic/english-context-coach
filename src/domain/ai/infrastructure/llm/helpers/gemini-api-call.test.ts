import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import {
  callGeminiRaw,
  getGeminiResponseSchema,
  getGeminiThinkingConfig,
} from "./gemini-api-call";

const mockGenerateContent = vi.fn();
const mockGenerateContentStream = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: mockGenerateContent,
          generateContentStream: mockGenerateContentStream,
        },
      };
    }),
    ThinkingLevel: {
      MINIMAL: "MINIMAL",
    },
  };
});

describe("geminiApiCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should make a unary call successfully", async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: '{"result": "success"}' }],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 20,
      },
    });

    const result = await callGeminiRaw({
      apiKey: "test-api-key",
      model: "gemini-2.5-flash",
      prompt: "Hello",
      purpose: "grading",
    });

    expect(result).toEqual({
      text: '{"result": "success"}',
      inputTokens: 10,
      outputTokens: 20,
    });
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: "gemini-2.5-flash",
      contents: "Hello",
      config: expect.any(Object),
    });
  });

  it("should fallback to result.text when parts array is empty in unary call", async () => {
    mockGenerateContent.mockResolvedValue({
      text: "fallback-text",
      usageMetadata: {
        promptTokenCount: 5,
        candidatesTokenCount: 10,
      },
    });

    const result = await callGeminiRaw({
      apiKey: "test-api-key",
      model: "gemini-2.5-flash",
      prompt: "Hello",
      purpose: "grading",
    });

    expect(result.text).toBe("fallback-text");
  });

  it("should make a stream call when onThought is provided", async () => {
    const chunk1 = {
      candidates: [
        {
          content: {
            parts: [{ text: "thought-chunk", thought: true }],
          },
        },
      ],
    };
    const chunk2 = {
      candidates: [
        {
          content: {
            parts: [{ text: '{"score": 10}' }],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 8,
        candidatesTokenCount: 15,
      },
    };

    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield chunk1;
        yield chunk2;
      },
    };
    mockGenerateContentStream.mockResolvedValue(mockStream);

    const thoughts: string[] = [];
    const onThought = async (text: string) => {
      thoughts.push(text);
    };

    const result = await callGeminiRaw({
      apiKey: "test-api-key",
      model: "gemini-2.5-flash",
      prompt: "Hello",
      purpose: "grading",
      onThought,
    });

    expect(result).toEqual({
      text: '{"score": 10}',
      inputTokens: 8,
      outputTokens: 15,
    });
    expect(thoughts).toEqual(["thought-chunk"]);
    expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);
  });

  it("should trigger timeout on abort signal / timeout limit", async () => {
    mockGenerateContent.mockImplementation((args) => {
      const config = args.config;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve({
            candidates: [{ content: { parts: [{ text: "success" }] } }],
          });
        }, 100);

        if (config?.abortSignal) {
          config.abortSignal.addEventListener("abort", () => {
            clearTimeout(timeout);
            const err = new Error("AbortError");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    });

    await expect(
      callGeminiRaw(
        {
          apiKey: "test-api-key",
          model: "gemini-2.5-flash",
          prompt: "Hello",
          purpose: "grading",
        },
        { timeoutMs: 5 }
      )
    ).rejects.toThrow("Gemini API request timed out after 5ms");
  });

  it("should allow callRawOverride to bypass actual Gemini call", async () => {
    const overrideFn = vi.fn().mockResolvedValue({
      text: "bypassed-data",
      inputTokens: 1,
      outputTokens: 2,
    });

    const result = await callGeminiRaw(
      {
        apiKey: "test-api-key",
        model: "gemini-2.5-flash",
        prompt: "Hello",
        purpose: "grading",
      },
      { callRawOverride: overrideFn }
    );

    expect(result.text).toBe("bypassed-data");
    expect(overrideFn).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  describe("getGeminiResponseSchema", () => {
    it("should return undefined if no zodSchema is provided", () => {
      expect(getGeminiResponseSchema(undefined)).toBeUndefined();
    });

    it("should clean and return schema when zodSchema is provided", () => {
      const schema = z.object({ score: z.number() });
      const result = getGeminiResponseSchema(schema);
      expect(result).toBeDefined();
      expect(result.type).toBe("object");
    });
  });

  describe("getGeminiThinkingConfig", () => {
    it("should return includeThoughts config if hasOnThought is true", () => {
      const config = getGeminiThinkingConfig({
        hasOnThought: true,
        thinkingLevel: "MINIMAL" as any,
        isGemini3: false,
        isThinkingModel: false,
      });
      expect(config).toEqual({
        includeThoughts: true,
        thinkingLevel: "MINIMAL",
      });
    });

    it("should return minimal thinkingLevel config if isGemini3 is true", () => {
      const config = getGeminiThinkingConfig({
        hasOnThought: false,
        thinkingLevel: "MINIMAL" as any,
        isGemini3: true,
        isThinkingModel: false,
      });
      expect(config).toEqual({
        thinkingLevel: "MINIMAL",
      });
    });

    it("should return thinkingBudget 0 if isThinkingModel is true", () => {
      const config = getGeminiThinkingConfig({
        hasOnThought: false,
        thinkingLevel: "MINIMAL" as any,
        isGemini3: false,
        isThinkingModel: true,
      });
      expect(config).toEqual({
        thinkingBudget: 0,
      });
    });

    it("should return undefined if none of the conditions match", () => {
      const config = getGeminiThinkingConfig({
        hasOnThought: false,
        thinkingLevel: "MINIMAL" as any,
        isGemini3: false,
        isThinkingModel: false,
      });
      expect(config).toBeUndefined();
    });
  });
});
