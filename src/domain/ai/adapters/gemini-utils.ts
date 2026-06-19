import { ThinkingLevel, GoogleGenAI } from "@google/genai";
import { z } from "zod";
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

export function zodToGeminiSchema(zodSchema: z.ZodTypeAny): any {
  let schema = zodSchema;
  let isNullable = false;

  // Unwrap nested optionals, nullables, effects (refinements), defaults, and readonly recursively
  while (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodEffects ||
    schema instanceof z.ZodDefault ||
    schema instanceof z.ZodReadonly
  ) {
    if (schema instanceof z.ZodNullable) {
      isNullable = true;
    }
    if (schema instanceof z.ZodEffects) {
      schema = schema.innerType();
    } else if (schema instanceof z.ZodDefault) {
      schema = schema._def.innerType;
    } else {
      schema = schema.unwrap();
    }
  }

  let result: any = {};

  if (schema instanceof z.ZodString) {
    result = { type: "STRING" };
  } else if (schema instanceof z.ZodNumber) {
    const isInteger = schema._def.checks.some((c: any) => c.kind === "int");
    result = { type: isInteger ? "INTEGER" : "NUMBER" };
  } else if (schema instanceof z.ZodBoolean) {
    result = { type: "BOOLEAN" };
  } else if (schema instanceof z.ZodLiteral) {
    result = {
      type: "STRING",
      enum: [schema._def.value],
    };
  } else if (schema instanceof z.ZodEnum) {
    result = {
      type: "STRING",
      enum: schema._def.values,
    };
  } else if (schema instanceof z.ZodArray) {
    result = {
      type: "ARRAY",
      items: zodToGeminiSchema(schema.element),
    };
  } else if (schema instanceof z.ZodObject) {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(schema.shape)) {
      properties[key] = zodToGeminiSchema(value as z.ZodTypeAny);

      let isOptional = false;
      let valSchema = value as z.ZodTypeAny;
      while (
        valSchema instanceof z.ZodOptional ||
        valSchema instanceof z.ZodNullable ||
        valSchema instanceof z.ZodEffects ||
        valSchema instanceof z.ZodDefault ||
        valSchema instanceof z.ZodReadonly
      ) {
        if (
          valSchema instanceof z.ZodOptional ||
          valSchema instanceof z.ZodNullable
        ) {
          isOptional = true;
        }
        if (valSchema instanceof z.ZodEffects) {
          valSchema = valSchema.innerType();
        } else if (valSchema instanceof z.ZodDefault) {
          valSchema = valSchema._def.innerType;
        } else {
          valSchema = valSchema.unwrap();
        }
      }
      if (!isOptional) {
        required.push(key);
      }
    }

    result = {
      type: "OBJECT",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  } else if (schema instanceof z.ZodDiscriminatedUnion) {
    const options = Array.from(schema.options.values()).map((opt) =>
      zodToGeminiSchema(opt as z.ZodTypeAny)
    );
    result = {
      anyOf: options,
    };
  } else if (schema instanceof z.ZodUnion) {
    const options = schema._def.options.map((opt: z.ZodTypeAny) =>
      zodToGeminiSchema(opt)
    );
    result = {
      anyOf: options,
    };
  } else {
    result = { type: "STRING" };
  }

  if (isNullable) {
    result.nullable = true;
  }

  return result;
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
