import { ThinkingLevel, GoogleGenAI } from "@google/genai";
import { SCHEMA_VERSIONS } from "@/domain/constants";

export class AiError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
  }
}

const geminiThinkingLevels = new Set(["MINIMAL", "LOW", "MEDIUM", "HIGH"]);

export function getGeminiThinkingLevel() {
  const value = (process.env.GEMINI_THINKING_LEVEL ?? "MINIMAL")
    .trim()
    .toUpperCase();
  if (!geminiThinkingLevels.has(value)) return ThinkingLevel.MINIMAL;
  return ThinkingLevel[value as keyof typeof ThinkingLevel];
}

import { JsonParserService } from "./json-parser-service";

export function extractJson(text: string): string {
  const extracted = JsonParserService.extractJson(text);
  return JsonParserService.repairJson(extracted);
}

export function coerceJsonForSchema(
  input: unknown,
  schemaVersion: keyof typeof SCHEMA_VERSIONS
): any {
  return JsonParserService.coerceJsonForSchema(input, schemaVersion);
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const name = model.toLowerCase();
  let inputRate = 0.075; // USD per 1M tokens -> micro-dollars per token
  let outputRate = 0.3;

  if (name.includes("pro")) {
    inputRate = 1.25;
    outputRate = 5.0;
  }
  return Math.round(inputTokens * inputRate + outputTokens * outputRate);
}

export function isRateLimitError(err: any): boolean {
  const msg = String(err.message || "").toUpperCase();
  const status = err.status || err.statusCode;
  return (
    status === 429 ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("RATE_LIMIT") ||
    msg.includes("QUOTA")
  );
}

export function isInvalidKeyError(err: any): boolean {
  const msg = String(err.message || "").toUpperCase();
  const status = err.status || err.statusCode;
  return (
    status === 400 ||
    status === 403 ||
    msg.includes("400") ||
    msg.includes("403") ||
    msg.includes("API_KEY_INVALID") ||
    msg.includes("INVALID_API_KEY") ||
    msg.includes("API_KEY")
  );
}

export async function verifyGeminiApiKey(
  apiKey: string
): Promise<string | null> {
  const GEMINI_TEST_MODEL = "gemini-3.1-flash-lite";
  try {
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({
      model: GEMINI_TEST_MODEL,
      contents: "ping",
    });
    return null;
  } catch (error: any) {
    if (isInvalidKeyError(error)) {
      return "API Key không hợp lệ hoặc không có quyền truy cập. Vui lòng kiểm tra lại.";
    }
    if (isRateLimitError(error)) {
      return "Tài khoản Gemini đã hết hạn ngạch (Quota Exceeded) hoặc bị giới hạn lượt gọi (Rate Limit).";
    }
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("fetch failed")) {
      return "Không thể kết nối đến máy chủ Gemini (lỗi kết nối mạng).";
    }
    return `Lỗi xác thực Gemini: ${msg}`;
  }
}
