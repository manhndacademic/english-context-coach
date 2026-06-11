import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { db, schema } from "@/db";
import { SCHEMA_VERSIONS } from "@/domain/constants";
import { hashCanonicalPayload } from "@/domain/text";
import { repairPrompt } from "./prompts";

export type AiPurpose = "analysis" | "exercise_generation" | "grading" | "repair";

export type GenerateJsonOptions<T> = {
  userId?: string;
  lessonId?: string;
  purpose: AiPurpose;
  prompt: string;
  promptVersion: string;
  schemaVersion: keyof typeof SCHEMA_VERSIONS;
  schema: z.ZodType<T>;
  modelKind: "analysis" | "fast";
  onThought?: (text: string) => Promise<void>;
};

export class AiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

const geminiThinkingLevels = new Set(["MINIMAL", "LOW", "MEDIUM", "HIGH"]);

function getModel(modelKind: "analysis" | "fast") {
  if (modelKind === "analysis") {
    return process.env.GEMINI_ANALYSIS_MODEL ?? "gemini-3.1-pro-preview";
  }
  return process.env.GEMINI_FAST_MODEL ?? "gemini-3.5-flash";
}

export function getGeminiThinkingLevel() {
  const value = (process.env.GEMINI_THINKING_LEVEL ?? "MINIMAL").trim().toUpperCase();
  if (!geminiThinkingLevels.has(value)) return ThinkingLevel.MINIMAL;
  return ThinkingLevel[value as keyof typeof ThinkingLevel];
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  if (trimmed.startsWith("[")) return trimmed;
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match?.[1]?.trim() ?? trimmed;
}

export function coerceJsonForSchema(input: unknown, schemaVersion: keyof typeof SCHEMA_VERSIONS) {
  if (schemaVersion === "exercises" && Array.isArray(input)) {
    return { exercises: input };
  }
  if ((schemaVersion === "analysis" || schemaVersion === "grading") && Array.isArray(input) && input.length === 1) {
    return input[0];
  }
  if (schemaVersion === "grading" && input && typeof input === "object" && !Array.isArray(input)) {
    const record = { ...(input as Record<string, unknown>) };
    for (const key of ["errorType", "explanationVi"] as const) {
      if (record[key] === null || record[key] === "") {
        delete record[key];
      }
    }
    return record;
  }
  return input;
}

async function callGemini(prompt: string, model: string, onThought?: (text: string) => Promise<void>) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiError("GEMINI_API_KEY is not configured.", "missing_api_key");
  }

  const ai = new GoogleGenAI({ apiKey });
  const config = {
    responseMimeType: "application/json",
    systemInstruction:
      "When thought summaries are available, write them in Vietnamese for the learner. The final response must be valid JSON only.",
    thinkingConfig: onThought
      ? {
          includeThoughts: true,
          thinkingLevel: getGeminiThinkingLevel(),
        }
      : undefined,
  };

  if (onThought) {
    const response = await ai.models.generateContentStream({
      model,
      contents: prompt,
      config,
    });
    let answer = "";

    for await (const chunk of response) {
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (!part.text) continue;
        if (part.thought) {
          await onThought(part.text);
        } else {
          answer += part.text;
        }
      }
    }

    return answer;
  }

  const result = await ai.models.generateContent({
    model,
    contents: prompt,
    config,
  });

  return result.text ?? "";
}

async function recordAiRequest(input: {
  userId?: string;
  lessonId?: string;
  purpose: AiPurpose;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  payloadHash: string;
  status: "succeeded" | "failed";
  latencyMs: number;
  errorClass?: string;
}) {
  await db.insert(schema.aiRequests).values({
    userId: input.userId,
    lessonId: input.lessonId,
    purpose: input.purpose,
    provider: "gemini",
    model: input.model,
    promptVersion: input.promptVersion,
    schemaVersion: input.schemaVersion,
    payloadHash: input.payloadHash,
    status: input.status,
    latencyMs: input.latencyMs,
    errorClass: input.errorClass,
  });
}

export async function generateJson<T>(options: GenerateJsonOptions<T>): Promise<T> {
  const model = getModel(options.modelKind);
  const payloadHash = hashCanonicalPayload({
    prompt: options.prompt,
    promptVersion: options.promptVersion,
    schemaVersion: SCHEMA_VERSIONS[options.schemaVersion],
  });
  const startedAt = Date.now();

  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const raw = await callGemini(options.prompt, model, options.onThought);
      const parsedJson = coerceJsonForSchema(JSON.parse(extractJson(raw)), options.schemaVersion);
      const parsed = options.schema.safeParse(parsedJson);
      if (parsed.success) {
        await recordAiRequest({
          ...options,
          model,
          schemaVersion: SCHEMA_VERSIONS[options.schemaVersion],
          payloadHash,
          status: "succeeded",
          latencyMs: Date.now() - startedAt,
        });
        return parsed.data;
      }

      const repaired = await callGemini(repairPrompt(raw, options.schemaVersion), model);
      const repairedJson = coerceJsonForSchema(JSON.parse(extractJson(repaired)), options.schemaVersion);
      const repairedParsed = options.schema.safeParse(repairedJson);
      if (repairedParsed.success) {
        await recordAiRequest({
          ...options,
          purpose: "repair",
          model,
          schemaVersion: SCHEMA_VERSIONS[options.schemaVersion],
          payloadHash,
          status: "succeeded",
          latencyMs: Date.now() - startedAt,
        });
        return repairedParsed.data;
      }

      if (attempt === 2) {
        throw new AiError("AI returned JSON that did not match the expected schema after repair.", "invalid_json_schema");
      }
    }

    throw new AiError("AI returned JSON that did not match the expected schema after retry.", "invalid_json_schema");
  } catch (error) {
    await recordAiRequest({
      ...options,
      model,
      schemaVersion: SCHEMA_VERSIONS[options.schemaVersion],
      payloadHash,
      status: "failed",
      latencyMs: Date.now() - startedAt,
      errorClass: error instanceof AiError ? error.code : error instanceof Error ? error.name : "unknown",
    });
    throw error;
  }
}
