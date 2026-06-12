import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { createHash } from "node:crypto";
import { db, schema } from "@/db";
import { SCHEMA_VERSIONS } from "@/domain/constants";
import { repairPrompt } from "./prompts";

function hashCanonicalPayload(payload: unknown): string {
  const serialized = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash("sha256").update(serialized).digest("hex");
}

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
    return process.env.GEMINI_ANALYSIS_MODEL ?? "gemini-3.1-flash-lite";
  }
  return process.env.GEMINI_FAST_MODEL ?? "gemini-3.1-flash-lite";
}

export function getGeminiThinkingLevel() {
  const value = (process.env.GEMINI_THINKING_LEVEL ?? "MINIMAL").trim().toUpperCase();
  if (!geminiThinkingLevels.has(value)) return ThinkingLevel.MINIMAL;
  return ThinkingLevel[value as keyof typeof ThinkingLevel];
}

function cleanJsonString(str: string): string {
  const trimmed = str.trim();
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");

  if (firstBrace === -1 && firstBracket === -1) {
    return trimmed;
  }

  const startIdx =
    firstBrace === -1
      ? firstBracket
      : firstBracket === -1
        ? firstBrace
        : Math.min(firstBrace, firstBracket);
  const charStack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < trimmed.length; i += 1) {
    const char = trimmed[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{" || char === "[") {
        charStack.push(char);
      } else if (char === "}") {
        if (charStack.length > 0 && charStack[charStack.length - 1] === "{") {
          charStack.pop();
        }
      } else if (char === "]") {
        if (charStack.length > 0 && charStack[charStack.length - 1] === "[") {
          charStack.pop();
        }
      }

      if (charStack.length === 0) {
        return trimmed.substring(startIdx, i + 1);
      }
    }
  }

  return trimmed.substring(startIdx);
}

export function extractJson(text: string) {
  const trimmed = text.trim();
  let candidate = trimmed;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    candidate = match?.[1]?.trim() ?? trimmed;
  }
  return cleanJsonString(candidate);
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
      "When progress notes are available, write short Vietnamese learner-facing status notes only. Do not mention code, JSON, schemas, prompts, chain-of-thought, or hidden reasoning. The final response must be valid JSON only.",
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
      
      let parsedJson: unknown;
      const extracted = extractJson(raw);
      try {
        parsedJson = coerceJsonForSchema(JSON.parse(extracted), options.schemaVersion);
      } catch (parseError) {
        console.error(`[AI Provider] JSON parsing failed on attempt ${attempt}.`);
        console.error(`[AI Provider] Raw response length: ${raw.length} characters.`);
        console.error(`[AI Provider] Raw response:\n---START---\n${raw}\n---END---`);
        console.error(`[AI Provider] Extracted string:\n---START---\n${extracted}\n---END---`);
        console.error(`[AI Provider] Parse error details:`, parseError);
        throw parseError;
      }

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

      console.warn(`[AI Provider] Schema validation failed on attempt ${attempt}. Validation error:`, parsed.error);

      console.log(`[AI Provider] Attempting repair...`);
      const repaired = await callGemini(repairPrompt(raw, options.schemaVersion), model);
      
      let repairedJson: unknown;
      const extractedRepaired = extractJson(repaired);
      try {
        repairedJson = coerceJsonForSchema(JSON.parse(extractedRepaired), options.schemaVersion);
      } catch (repairParseError) {
        console.error(`[AI Provider] Repaired JSON parsing failed.`);
        console.error(`[AI Provider] Repaired response length: ${repaired.length} characters.`);
        console.error(`[AI Provider] Repaired response:\n---START---\n${repaired}\n---END---`);
        console.error(`[AI Provider] Extracted repaired string:\n---START---\n${extractedRepaired}\n---END---`);
        console.error(`[AI Provider] Repair parse error details:`, repairParseError);
        throw repairParseError;
      }

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

      console.warn(`[AI Provider] Repair schema validation failed on attempt ${attempt}. Validation error:`, repairedParsed.error);

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
