import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq, and, or, lt } from "drizzle-orm";
import { SCHEMA_VERSIONS } from "@/domain/constants";
import { hashCanonicalPayload, decryptApiKey } from "@/lib/crypto";
import { repairPrompt } from "@/lib/ai/prompts";
import { getLogger } from "@/lib/logger";
import type { LLMProvider } from "../ports";
import { providerRotationPool } from "./model-pool";
import {
  AiError,
  extractJson,
  coerceJsonForSchema,
  getGeminiThinkingLevel,
  zodToGeminiSchema,
  estimateCost,
  isRateLimitError,
  isInvalidKeyError,
} from "./gemini-utils";

const logger = getLogger("d.m.ai.GeminiLLMProvider", "ai-provider");

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
    logger.warn(`API key marked rate_limited: ${keyId}. Error: ${errorMsg}`);
  } catch (e) {
    logger.error(`Failed to update rate_limited status for key ${keyId}:`, e);
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
    logger.error(`API key marked invalid: ${keyId}. Error: ${errorMsg}`);
  } catch (e) {
    logger.error(`Failed to update invalid status for key ${keyId}:`, e);
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
        logger.error(`Failed to decrypt user key for ${userId}:`, e);
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
          lt(schema.aiApiKeys.rateLimitedAt, oneMinuteAgo)
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
      logger.error(`Failed to decrypt system key ${picked.name}:`, e);
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
        logger.info(`API key reset to active: ${keyId}`);
      }

      return { text, inputTokens, outputTokens };
    } catch (err: any) {
      logger.warn(
        `[AI Provider] Call failed (model: ${model}, key: ${keyId || "env/user"}, attempt: ${attempts}): ${err.message || err}`
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
      logger.warn(`Model "${model}" is cooling down — trying next.`);
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
        logger.warn(
          `Model "${model}" rate-limited or keys exhausted. Rotating to next model (${modelIdx + 1}/${models.length} tried).`
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

export class GeminiLLMProvider implements LLMProvider {
  async generateJson<T>(options: {
    userId?: string;
    lessonId?: string;
    purpose: "analysis" | "exercise_generation" | "grading" | "repair";
    prompt: string;
    promptVersion: string;
    schemaVersion: string;
    schema: z.ZodType<T>;
    modelKind: "analysis" | "fast";
    onThought?: (text: string) => Promise<void>;
  }): Promise<T> {
    const payloadHash = hashCanonicalPayload({
      prompt: options.prompt,
      promptVersion: options.promptVersion,
      schemaVersion: SCHEMA_VERSIONS[options.schemaVersion as keyof typeof SCHEMA_VERSIONS],
    });
    const startedAt = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let resolvedModel = providerRotationPool.getNextAvailable(options.modelKind);
    let status: "succeeded" | "failed" = "failed";
    let errorClass: string | null = null;

    try {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
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
            parsedJson = coerceJsonForSchema(JSON.parse(extracted), options.schemaVersion as keyof typeof SCHEMA_VERSIONS);
          } catch (parseError) {
            logger.error(`JSON parsing failed on attempt ${attempt}.`);
            logger.error(`Raw response length: ${raw.length} characters.`);
            logger.error(`Raw response:\n---START---\n${raw}\n---END---`);
            logger.error(`Extracted string:\n---START---\n${extracted}\n---END---`);
            logger.error(`Parse error details:`, parseError);
            throw parseError;
          }

          const parsed = options.schema.safeParse(parsedJson);
          if (parsed.success) {
            status = "succeeded";
            return parsed.data;
          }

          logger.warn(`Schema validation failed on attempt ${attempt}. Validation error: ${parsed.error.toString()}`);

          logger.info(`Attempting repair...`);
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
            repairedJson = coerceJsonForSchema(JSON.parse(extractedRepaired), options.schemaVersion as keyof typeof SCHEMA_VERSIONS);
          } catch (repairParseError) {
            logger.error(`Repaired JSON parsing failed.`);
            logger.error(`Repaired response length: ${repaired.length} characters.`);
            logger.error(`Repaired response:\n---START---\n${repaired}\n---END---`);
            logger.error(`Extracted repaired string:\n---START---\n${extractedRepaired}\n---END---`);
            logger.error(`Repair parse error details:`, repairParseError);
            throw repairParseError;
          }

          const repairedParsed = options.schema.safeParse(repairedJson);
          if (repairedParsed.success) {
            status = "succeeded";
            return repairedParsed.data;
          }

          logger.warn(`Repair schema validation failed on attempt ${attempt}. Validation error: ${repairedParsed.error.toString()}`);

          if (attempt === 2) {
            throw new AiError("AI returned JSON that did not match the expected schema after repair.", "invalid_json_schema");
          }
        } catch (innerError) {
          if (attempt === 2) {
            throw innerError;
          }
          logger.warn(`Retryable operation failed on attempt ${attempt}. Retrying...`);
        }
      }

      throw new AiError("AI returned JSON that did not match the expected schema after retry.", "invalid_json_schema");
    } catch (error) {
      errorClass = error instanceof AiError ? error.code : error instanceof Error ? error.name : "unknown";
      throw error;
    } finally {
      // Record AI request directly to DB
      try {
        await db.insert(schema.aiRequests).values({
          userId: options.userId ?? null,
          lessonId: options.lessonId ?? null,
          purpose: options.purpose,
          provider: "gemini",
          model: resolvedModel,
          promptVersion: options.promptVersion,
          schemaVersion: SCHEMA_VERSIONS[options.schemaVersion as keyof typeof SCHEMA_VERSIONS],
          payloadHash,
          status,
          latencyMs: Date.now() - startedAt,
          inputTokens: totalInputTokens || null,
          outputTokens: totalOutputTokens || null,
          costMicros: estimateCost(resolvedModel, totalInputTokens, totalOutputTokens),
          errorClass,
        });
      } catch (dbErr) {
        logger.error("Failed to record AI request to DB:", dbErr);
      }
    }
  }
}
