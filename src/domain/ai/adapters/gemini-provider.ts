import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getLogger } from "@/lib/logger";
import type { LLMProvider, KeyResolver, AiRequestRecorder } from "../ports";
import { DrizzleKeyResolver } from "./key-resolver";
import { DrizzleAiRequestRecorder } from "./ai-request-recorder";
import { providerRotationPool } from "./model-pool";
import {
  DefaultLLMResiliencyManager,
  LLMResiliencyManager,
} from "./resiliency-manager";
import { getGeminiThinkingLevel, zodToGeminiSchema } from "./gemini-utils";

const logger = getLogger("d.m.ai.GeminiLLMProvider", "ai-provider");

type AiPurpose = "analysis" | "exercise_generation" | "grading" | "repair";

function getEnvTokenLimit(envVar: string, defaultValue: number): number {
  const envVal = process.env[envVar];
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
    logger.warn(
      `[AI Config] Invalid value for environment variable ${envVar}: "${envVal}". Falling back to default: ${defaultValue}`
    );
  }
  return defaultValue;
}

export function generationConfigForPurpose(purpose: AiPurpose) {
  switch (purpose) {
    case "grading":
      return {
        maxOutputTokens: getEnvTokenLimit(
          "GEMINI_MAX_OUTPUT_TOKENS_GRADING",
          700
        ),
        temperature: 0.1,
        topP: 0.8,
        systemInstruction:
          "Return compact valid JSON only. Do not include markdown. Do not list multiple alternative answers unless explicitly requested. For grading, naturalAnswer must be exactly one best answer in the expected target language (Vietnamese or English depending on the prompt). Keep all fields concise and bounded.",
      };
    case "analysis":
      return {
        maxOutputTokens: getEnvTokenLimit(
          "GEMINI_MAX_OUTPUT_TOKENS_ANALYSIS",
          8192
        ),
        systemInstruction:
          "When progress notes are available, write short Vietnamese learner-facing status notes only. Do not mention code, JSON, schemas, prompts, chain-of-thought, or hidden reasoning. The final response must be valid JSON only.",
      };
    case "exercise_generation":
      return {
        maxOutputTokens: getEnvTokenLimit(
          "GEMINI_MAX_OUTPUT_TOKENS_EXERCISE",
          2200
        ),
        systemInstruction:
          "When progress notes are available, write short Vietnamese learner-facing status notes only. Do not mention code, JSON, schemas, prompts, chain-of-thought, or hidden reasoning. The final response must be valid JSON only.",
      };
    case "repair":
      return {
        maxOutputTokens: getEnvTokenLimit(
          "GEMINI_MAX_OUTPUT_TOKENS_REPAIR",
          1200
        ),
        temperature: 0.1,
        systemInstruction:
          "Repair the response into compact valid JSON only. Do not include markdown or commentary. Preserve the original meaning while fitting the requested schema.",
      };
  }
}

export { parseApiKeys } from "./key-resolver";

export class GeminiLLMProvider implements LLMProvider {
  constructor(
    keyResolver: KeyResolver = new DrizzleKeyResolver(),
    requestRecorder: AiRequestRecorder = new DrizzleAiRequestRecorder(),
    private readonly resiliencyManager: LLMResiliencyManager = new DefaultLLMResiliencyManager(
      keyResolver,
      requestRecorder
    )
  ) {}

  private async callGeminiRaw(options: {
    apiKey: string;
    model: string;
    prompt: string;
    purpose: AiPurpose;
    zodSchema?: z.ZodTypeAny;
    onThought?: (text: string) => Promise<void>;
  }): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const globalThinkingLevel = getGeminiThinkingLevel();
    const thinkingLevel = providerRotationPool.getThinkingLevel(
      options.model,
      globalThinkingLevel
    );

    const ai = new GoogleGenAI({ apiKey: options.apiKey });
    const purposeConfig = generationConfigForPurpose(options.purpose);
    const config = {
      ...purposeConfig,
      responseMimeType: "application/json",
      responseSchema: options.zodSchema
        ? zodToGeminiSchema(options.zodSchema)
        : undefined,
      thinkingConfig: options.onThought
        ? {
            includeThoughts: true,
            thinkingLevel,
          }
        : undefined,
    };

    let text = "";
    let inputTokens = 0;
    let outputTokens = 0;

    logger.info(
      `[AI Provider] Calling Gemini API (model: ${options.model}, purpose: ${options.purpose})...`
    );
    const callStartTime = Date.now();

    if (options.onThought) {
      const response = await ai.models.generateContentStream({
        model: options.model,
        contents: options.prompt,
        config,
      });

      for await (const chunk of response) {
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          if (!part.text) continue;
          if (part.thought) {
            await options.onThought(part.text);
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
        model: options.model,
        contents: options.prompt,
        config,
      });

      text = result.text ?? "";
      if (result.usageMetadata) {
        inputTokens = result.usageMetadata.promptTokenCount ?? 0;
        outputTokens = result.usageMetadata.candidatesTokenCount ?? 0;
      }
    }

    logger.info(
      `[AI Provider] Gemini API Success (model: ${options.model}) in ${Date.now() - callStartTime}ms. Tokens: in=${inputTokens}, out=${outputTokens}`
    );

    return { text, inputTokens, outputTokens };
  }

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
    return this.resiliencyManager.execute(options, {
      call: async (callOpts) => {
        return this.callGeminiRaw({
          apiKey: callOpts.apiKey,
          model: callOpts.model,
          prompt: callOpts.prompt,
          purpose: callOpts.purpose as AiPurpose,
          zodSchema: callOpts.zodSchema,
          onThought: callOpts.onThought,
        });
      },
    });
  }
}
