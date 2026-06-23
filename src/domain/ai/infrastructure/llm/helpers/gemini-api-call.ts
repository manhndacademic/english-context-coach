import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { getLogger } from "@/lib/logger";
import { AiError, inlineRefs, cleanSchemaForGemini } from "../gemini-utils";
import { generationConfigForPurpose } from "./gemini-config";
import type { CallRawOptions, CallRawResult } from "../gemini-llm-provider";

const logger = getLogger("d.m.ai.geminiApiCall", "ai-provider");

export type CallRawOverride = (opts: CallRawOptions) => Promise<CallRawResult>;

export interface GeminiApiCallExtraOptions {
  callRawOverride?: CallRawOverride;
  timeoutMs?: number;
  thinkingLevel?: ThinkingLevel;
}

export function getGeminiResponseSchema(zodSchema?: z.ZodTypeAny): any {
  if (!zodSchema) return undefined;
  return cleanSchemaForGemini(inlineRefs(zodToJsonSchema(zodSchema)));
}

export function getGeminiThinkingConfig(options: {
  hasOnThought: boolean;
  thinkingLevel: ThinkingLevel;
  isGemini3: boolean;
  isThinkingModel: boolean;
}): any {
  const { hasOnThought, thinkingLevel, isGemini3, isThinkingModel } = options;

  if (hasOnThought) {
    return {
      includeThoughts: true,
      thinkingLevel,
    };
  }

  if (isGemini3) {
    return {
      thinkingLevel: ThinkingLevel.MINIMAL,
    };
  }

  if (isThinkingModel) {
    return {
      thinkingBudget: 0,
    };
  }

  return undefined;
}

export async function callGeminiRaw(
  rawOpts: CallRawOptions,
  extraOpts: GeminiApiCallExtraOptions = {}
): Promise<CallRawResult> {
  if (extraOpts.callRawOverride) {
    return extraOpts.callRawOverride(rawOpts);
  }

  const thinkingLevel = extraOpts.thinkingLevel ?? ThinkingLevel.MINIMAL;

  const modelLower = rawOpts.model.toLowerCase();
  const isGemini3 = modelLower.includes("gemini-3");
  const isThinkingModel =
    modelLower.includes("gemini-2") ||
    isGemini3 ||
    modelLower.includes("-thinking");

  const ai = new GoogleGenAI({ apiKey: rawOpts.apiKey });
  const purposeConfig = generationConfigForPurpose(rawOpts.purpose);

  const timeoutMs =
    extraOpts.timeoutMs ??
    (parseInt(process.env.GEMINI_TIMEOUT_MS ?? "", 10) || 60_000);
  const controller = new AbortController();

  const config = {
    ...purposeConfig,
    responseMimeType: "application/json",
    responseJsonSchema: getGeminiResponseSchema(rawOpts.zodSchema),
    thinkingConfig: getGeminiThinkingConfig({
      hasOnThought: !!rawOpts.onThought,
      thinkingLevel,
      isGemini3,
      isThinkingModel,
    }),
    abortSignal: controller.signal,
  };

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;

  logger.info(
    `[AI Provider] Calling Gemini API (model: ${rawOpts.model}, purpose: ${rawOpts.purpose})...`
  );
  const callStartTime = Date.now();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (rawOpts.onThought) {
      const streamResult = await callGeminiStream({
        ai,
        model: rawOpts.model,
        prompt: rawOpts.prompt,
        config,
        onThought: rawOpts.onThought,
      });
      text = streamResult.text;
      inputTokens = streamResult.inputTokens;
      outputTokens = streamResult.outputTokens;
    } else {
      const unaryResult = await callGeminiUnary({
        ai,
        model: rawOpts.model,
        prompt: rawOpts.prompt,
        config,
      });
      text = unaryResult.text;
      inputTokens = unaryResult.inputTokens;
      outputTokens = unaryResult.outputTokens;
    }
  } catch (err: any) {
    if (
      err.name === "AbortError" ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      throw new AiError(
        `Gemini API request timed out after ${timeoutMs}ms`,
        "timeout"
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
  }

  logger.info(
    `[AI Provider] Gemini API Success (model: ${rawOpts.model}) in ${Date.now() - callStartTime}ms. Tokens: in=${inputTokens}, out=${outputTokens}`
  );

  return { text, inputTokens, outputTokens };
}

export async function callGeminiStream(streamOpts: {
  ai: GoogleGenAI;
  model: string;
  prompt: string;
  config: any;
  onThought: (text: string) => Promise<void>;
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const { ai, model, prompt, config, onThought } = streamOpts;
  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;

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

  return { text, inputTokens, outputTokens };
}

export async function callGeminiUnary(unaryOpts: {
  ai: GoogleGenAI;
  model: string;
  prompt: string;
  config: any;
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const { ai, model, prompt, config } = unaryOpts;
  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const result = await ai.models.generateContent({
    model,
    contents: prompt,
    config,
  });

  const parts = result.candidates?.[0]?.content?.parts ?? [];
  if (parts.length > 0) {
    let partsText = "";
    for (const part of parts) {
      if (!part.thought && part.text) {
        partsText += part.text;
      }
    }
    text = partsText;
  } else {
    text = result.text ?? "";
  }

  if (result.usageMetadata) {
    inputTokens = result.usageMetadata.promptTokenCount ?? 0;
    outputTokens = result.usageMetadata.candidatesTokenCount ?? 0;
  }

  return { text, inputTokens, outputTokens };
}
