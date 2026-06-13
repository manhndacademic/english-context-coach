import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { SCHEMA_VERSIONS } from "@/domain/constants";
import { hashCanonicalPayload, decryptApiKey } from "@/lib/crypto";
import { repairPrompt } from "./prompts";
import { db, schema } from "@/db";
import { eq, and, or, gt } from "drizzle-orm";
import { providerRotationPool } from "./model_pool";


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
  onRecordRequest?: (record: {
    userId?: string;
    lessonId?: string;
    purpose: AiPurpose;
    model: string;
    promptVersion: string;
    schemaVersion: string;
    payloadHash: string;
    status: "succeeded" | "failed";
    latencyMs: number;
    inputTokens?: number;
    outputTokens?: number;
    costMicros?: number;
    errorClass?: string;
  }) => Promise<void>;
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

function stripNulls(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(stripNulls);
  }
  if (obj !== null && typeof obj === "object") {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== null) {
        newObj[key] = stripNulls(val);
      }
    }
    return newObj;
  }
  return obj;
}

export function coerceJsonForSchema(input: unknown, schemaVersion: keyof typeof SCHEMA_VERSIONS) {
  const cleaned = stripNulls(input);
  if (schemaVersion === "exercises" && Array.isArray(cleaned)) {
    return { exercises: cleaned };
  }
  if ((schemaVersion === "analysis" || schemaVersion === "grading") && Array.isArray(cleaned) && cleaned.length === 1) {
    return cleaned[0];
  }
  if (schemaVersion === "grading" && cleaned && typeof cleaned === "object" && !Array.isArray(cleaned)) {
    const record = { ...(cleaned as Record<string, any>) };
    
    // Clean top-level nulls/empty strings
    for (const key of ["naturalAnswer", "literalTranslationTrap", "errorType", "explanationVi"] as const) {
      if (record[key] === null || record[key] === "" || record[key] === "none") {
        delete record[key];
      }
    }
    
    // Clean nested error object
    if (record.error && typeof record.error === "object") {
      const errorObj = { ...record.error };
      if (
        errorObj.shouldSave === false ||
        errorObj.shouldSave === "false" ||
        record.isCorrect === true
      ) {
        delete record.error;
      } else {
        for (const key of ["errorType", "explanationVi", "targetItem"] as const) {
          if (errorObj[key] === null || errorObj[key] === "" || errorObj[key] === "none") {
            delete errorObj[key];
          }
        }
        record.error = errorObj;
      }
    }
    return record;
  }
  return cleaned;
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const name = model.toLowerCase();
  let inputRate = 0.075; // USD per 1M tokens -> micro-dollars per token
  let outputRate = 0.30;
  
  if (name.includes("pro")) {
    inputRate = 1.25;
    outputRate = 5.00;
  }
  return Math.round(inputTokens * inputRate + outputTokens * outputRate);
}

function isRateLimitError(err: any): boolean {
  const msg = String(err.message || "").toUpperCase();
  const status = err.status || err.statusCode;
  return status === 429 || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("RATE_LIMIT") || msg.includes("QUOTA");
}

function isInvalidKeyError(err: any): boolean {
  const msg = String(err.message || "").toUpperCase();
  const status = err.status || err.statusCode;
  return status === 400 || status === 403 || msg.includes("400") || msg.includes("403") || msg.includes("API_KEY_INVALID") || msg.includes("INVALID_API_KEY") || msg.includes("API_KEY");
}

async function markKeyRateLimited(keyId: string, errorMsg: string) {
  try {
    await db
      .update(schema.aiApiKeys)
      .set({
        status: "rate_limited",
        errorMessage: errorMsg,
        rateLimitedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.aiApiKeys.id, keyId));
  } catch (e) {
    console.error(`[AI Provider] Failed to update rate_limited status for key ${keyId}:`, e);
  }
}

async function markKeyInvalid(keyId: string, errorMsg: string) {
  try {
    await db
      .update(schema.aiApiKeys)
      .set({
        status: "invalid",
        errorMessage: errorMsg,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiApiKeys.id, keyId));
  } catch (e) {
    console.error(`[AI Provider] Failed to update invalid status for key ${keyId}:`, e);
  }
}

async function resolveApiKeyWithExclusions(
  userId?: string,
  excludedKeyIds?: Set<string>
): Promise<{ key: string; id?: string; isUserKey: boolean }> {
  // 1. Check if user has a custom API Key
  if (userId) {
    const [user] = await db
      .select({ customGeminiApiKey: schema.users.customGeminiApiKey })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (user?.customGeminiApiKey) {
      try {
        const key = decryptApiKey(user.customGeminiApiKey);
        if (key) {
          return { key, isUserKey: true };
        }
      } catch (e) {
        console.error(`[AI Provider] Failed to decrypt user key for ${userId}:`, e);
      }
    }
  }

  // 2. Check system keys in Database
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const systemKeys = await db
    .select()
    .from(schema.aiApiKeys)
    .where(
      or(
        eq(schema.aiApiKeys.status, "active"),
        and(
          eq(schema.aiApiKeys.status, "rate_limited"),
          gt(schema.aiApiKeys.rateLimitedAt, oneMinuteAgo)
        )
      )
    );

  // Filter out excluded key IDs
  const activeKeys = systemKeys.filter(
    (k) => !excludedKeyIds || !excludedKeyIds.has(k.id)
  );

  if (activeKeys.length > 0) {
    // Pick a key randomly
    const picked = activeKeys[Math.floor(Math.random() * activeKeys.length)];
    try {
      const key = decryptApiKey(picked.encryptedKey);
      return { key, id: picked.id, isUserKey: false };
    } catch (e) {
      console.error(`[AI Provider] Failed to decrypt system key ${picked.name}:`, e);
    }
  }

  // 3. Fall back to process.env.GEMINI_API_KEYS (comma-separated list) or process.env.GEMINI_API_KEY
  const envKeysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
  if (envKeysStr) {
    const envKeys = envKeysStr.split(",").map((k) => k.trim()).filter(Boolean);
    const activeEnvKeys = envKeys
      .map((key, index) => ({ key, id: `env-key-${index}` }))
      .filter((k) => !excludedKeyIds || !excludedKeyIds.has(k.id));

    if (activeEnvKeys.length > 0) {
      const picked = activeEnvKeys[Math.floor(Math.random() * activeEnvKeys.length)];
      return { key: picked.key, id: picked.id, isUserKey: false };
    }
  }

  throw new Error("No active system, user, or fallback API keys available.");
}

function zodToGeminiSchema(zodSchema: z.ZodTypeAny): any {
  let schema = zodSchema;
  while (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    schema = schema.unwrap();
  }

  if (schema instanceof z.ZodEffects) {
    schema = schema.innerType();
  }

  if (schema instanceof z.ZodString) {
    return { type: "STRING" };
  }

  if (schema instanceof z.ZodNumber) {
    const isInteger = schema._def.checks.some((c: any) => c.kind === "int");
    return { type: isInteger ? "INTEGER" : "NUMBER" };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: "BOOLEAN" };
  }

  if (schema instanceof z.ZodLiteral) {
    return {
      type: "STRING",
      enum: [schema._def.value],
    };
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: "STRING",
      enum: schema._def.values,
    };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: "ARRAY",
      items: zodToGeminiSchema(schema.element),
    };
  }

  if (schema instanceof z.ZodObject) {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(schema.shape)) {
      properties[key] = zodToGeminiSchema(value as z.ZodTypeAny);
      
      let isOptional = false;
      let valSchema = value as z.ZodTypeAny;
      while (valSchema instanceof z.ZodEffects) {
        valSchema = valSchema.innerType();
      }
      if (valSchema instanceof z.ZodOptional || valSchema instanceof z.ZodNullable) {
        isOptional = true;
      }
      if (!isOptional) {
        required.push(key);
      }
    }

    return {
      type: "OBJECT",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  if (schema instanceof z.ZodDiscriminatedUnion) {
    const options = Array.from(schema.options.values()).map(opt => zodToGeminiSchema(opt as z.ZodTypeAny));
    return {
      anyOf: options,
    };
  }

  if (schema instanceof z.ZodUnion) {
    const options = schema._def.options.map((opt: z.ZodTypeAny) => zodToGeminiSchema(opt));
    return {
      anyOf: options,
    };
  }

  return { type: "STRING" };
}

async function callGeminiWithKeyRetry(
  userId: string | undefined,
  prompt: string,
  model: string,
  thinkingLevel: ThinkingLevel,
  zodSchema?: z.ZodTypeAny,
  onThought?: (text: string) => Promise<void>
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  let attempts = 0;
  const maxKeyAttempts = 3;
  const excludedKeyIds = new Set<string>();

  while (attempts < maxKeyAttempts) {
    attempts++;

    let resolved;
    try {
      resolved = await resolveApiKeyWithExclusions(userId, excludedKeyIds);
    } catch (err: any) {
      throw new AiError(`Failed to resolve API key: ${err.message}`, "missing_api_key");
    }

    const { key, id: keyId, isUserKey } = resolved;

    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const config = {
        responseMimeType: "application/json",
        responseSchema: zodSchema ? zodToGeminiSchema(zodSchema) : undefined,
        systemInstruction:
          "When progress notes are available, write short Vietnamese learner-facing status notes only. Do not mention code, JSON, schemas, prompts, chain-of-thought, or hidden reasoning. The final response must be valid JSON only.",
        thinkingConfig: onThought
          ? {
              includeThoughts: true,
              thinkingLevel,
            }
          : undefined,
      };

      let text = "";
      let inputTokens = 0;
      let outputTokens = 0;

      if (onThought) {
        const response = await ai.models.generateContentStream({
          model,
          contents: prompt,
          config,
        });

        for await (const chunk of response) {
          for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
            if (!part.text) continue;
            if (part.thought) {
              await onThought(part.text);
            } else {
              text += part.text;
            }
          }
          if (chunk.usageMetadata) {
            inputTokens = chunk.usageMetadata.promptTokenCount ?? 0;
            outputTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
          }
        }
      } else {
        const result = await ai.models.generateContent({
          model,
          contents: prompt,
          config,
        });
        text = result.text ?? "";
        if (result.usageMetadata) {
          inputTokens = result.usageMetadata.promptTokenCount ?? 0;
          outputTokens = result.usageMetadata.candidatesTokenCount ?? 0;
        }
      }

      // If key was rate-limited or had errors but succeeded now, restore it
      if (keyId && !isUserKey && !keyId.startsWith("env-key-")) {
        await db
          .update(schema.aiApiKeys)
          .set({ status: "active", errorMessage: null, rateLimitedAt: null, updatedAt: new Date() })
          .where(eq(schema.aiApiKeys.id, keyId));
      }

      return { text, inputTokens, outputTokens };
    } catch (err: any) {
      console.warn(
        `[AI Provider] Call failed (model: ${model}, key: ${keyId || "env/user"}, attempt: ${attempts}):`,
        err.message || err
      );

      if (isUserKey) {
        throw new AiError(`Custom User API Key failed: ${err.message || err}`, "user_key_failed");
      }

      if (keyId) {
        excludedKeyIds.add(keyId);
        if (!keyId.startsWith("env-key-")) {
          if (isRateLimitError(err)) {
            await markKeyRateLimited(keyId, err.message || "Rate limit exceeded");
          } else if (isInvalidKeyError(err)) {
            await markKeyInvalid(keyId, err.message || "Invalid API key");
          }
        }
      } else {
        // env fallback key failed — re-throw directly, no more keys to try
        throw err;
      }

      if (attempts >= maxKeyAttempts) {
        // Signal to the outer model-rotation loop that all keys are exhausted for this model
        throw new AiError(
          `All API keys exhausted for model "${model}". Last error: ${err.message || err}`,
          "all_keys_failed"
        );
      }
    }
  }

  throw new AiError("AI provider error: request failed.", "unknown");
}

/**
 * Outer retry loop: iterates models from the ProviderRotationPool (see CONTEXT.md: ApiRotationPool).
 * For each model, delegates key rotation to callGeminiWithKeyRetry.
 * On 429/503 for a model, the pool cools it down and the next model is tried immediately.
 */
async function callGeminiWithRetry(
  userId: string | undefined,
  prompt: string,
  modelKind: "analysis" | "fast",
  zodSchema?: z.ZodTypeAny,
  onThought?: (text: string) => Promise<void>
): Promise<{ text: string; inputTokens: number; outputTokens: number; model: string }> {
  const globalThinkingLevel = getGeminiThinkingLevel();
  const models = providerRotationPool.getModels(modelKind);
  const exhaustedModels = new Set<string>();

  for (let modelIdx = 0; modelIdx < models.length; modelIdx++) {
    const model = providerRotationPool.getNextAvailable(modelKind, exhaustedModels);
    exhaustedModels.add(model);

    if (!providerRotationPool.isAvailable(model)) {
      console.warn(`[ProviderRotationPool] Model "${model}" is cooling down — trying next.`);
    }

    const thinkingLevel = providerRotationPool.getThinkingLevel(model, globalThinkingLevel);

    try {
      const result = await callGeminiWithKeyRetry(userId, prompt, model, thinkingLevel, zodSchema, onThought);
      // Success — clear any lingering model cooldown
      providerRotationPool.clearCooldown(model);
      return { ...result, model };
    } catch (err: any) {
      const isRateLimit = isRateLimitError(err) || err.code === "all_keys_failed";

      if (isRateLimit) {
        providerRotationPool.markRateLimited(model);
        console.warn(
          `[ProviderRotationPool] Model "${model}" rate-limited or keys exhausted. Rotating to next model (${modelIdx + 1}/${models.length - 1} remaining).`
        );
        // Try next model
        continue;
      }

      // Non-transient error (invalid key for user key, parse error, etc.) — re-throw
      throw err;
    }
  }

  throw new AiError(
    `All models in the ${modelKind} pool are rate-limited or unavailable. Tried: ${Array.from(exhaustedModels).join(", ")}.`,
    "all_models_failed"
  );
}

export async function generateJson<T>(options: GenerateJsonOptions<T>): Promise<T> {
  const payloadHash = hashCanonicalPayload({
    prompt: options.prompt,
    promptVersion: options.promptVersion,
    schemaVersion: SCHEMA_VERSIONS[options.schemaVersion],
  });
  const startedAt = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let resolvedModel = providerRotationPool.getNextAvailable(options.modelKind);

  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const { text: raw, inputTokens, outputTokens, model } = await callGeminiWithRetry(
        options.userId,
        options.prompt,
        options.modelKind,
        options.schema,
        options.onThought
      );
      resolvedModel = model;
      
      totalInputTokens = inputTokens;
      totalOutputTokens = outputTokens;

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
        if (options.onRecordRequest) {
          await options.onRecordRequest({
            userId: options.userId,
            lessonId: options.lessonId,
            purpose: options.purpose,
            model: resolvedModel,
            promptVersion: options.promptVersion,
            schemaVersion: SCHEMA_VERSIONS[options.schemaVersion],
            payloadHash,
            status: "succeeded",
            latencyMs: Date.now() - startedAt,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            costMicros: estimateCost(resolvedModel, totalInputTokens, totalOutputTokens),
          });
        }
        return parsed.data;
      }

      console.warn(`[AI Provider] Schema validation failed on attempt ${attempt}. Validation error:`, parsed.error);

      console.log(`[AI Provider] Attempting repair...`);
      const { text: repaired, inputTokens: repairIn, outputTokens: repairOut, model: repairModel } = await callGeminiWithRetry(
        options.userId,
        repairPrompt(raw, options.schemaVersion),
        options.modelKind,
        options.schema
      );
      resolvedModel = repairModel;
      
      totalInputTokens = repairIn;
      totalOutputTokens = repairOut;

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
        if (options.onRecordRequest) {
          await options.onRecordRequest({
            userId: options.userId,
            lessonId: options.lessonId,
            purpose: "repair",
            model: resolvedModel,
            promptVersion: options.promptVersion,
            schemaVersion: SCHEMA_VERSIONS[options.schemaVersion],
            payloadHash,
            status: "succeeded",
            latencyMs: Date.now() - startedAt,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            costMicros: estimateCost(resolvedModel, totalInputTokens, totalOutputTokens),
          });
        }
        return repairedParsed.data;
      }

      console.warn(`[AI Provider] Repair schema validation failed on attempt ${attempt}. Validation error:`, repairedParsed.error);

      if (attempt === 2) {
        throw new AiError("AI returned JSON that did not match the expected schema after repair.", "invalid_json_schema");
      }
    }

    throw new AiError("AI returned JSON that did not match the expected schema after retry.", "invalid_json_schema");
  } catch (error) {
    if (options.onRecordRequest) {
      await options.onRecordRequest({
        userId: options.userId,
        lessonId: options.lessonId,
        purpose: options.purpose,
        model: resolvedModel,
        promptVersion: options.promptVersion,
        schemaVersion: SCHEMA_VERSIONS[options.schemaVersion],
        payloadHash,
        status: "failed",
        latencyMs: Date.now() - startedAt,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        costMicros: estimateCost(resolvedModel, totalInputTokens, totalOutputTokens),
        errorClass: error instanceof AiError ? error.code : error instanceof Error ? error.name : "unknown",
      });
    }
    throw error;
  }
}

