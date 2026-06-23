import { getLogger } from "@/lib/logger";
import type { AiPurpose } from "@/domain/types";

const logger = getLogger("d.m.ai.GeminiConfig", "ai-provider");

export function getEnvTokenLimit(envVar: string, defaultValue: number): number {
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
          4096
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
          16384
        ),
        systemInstruction:
          "When progress notes are available, write short Vietnamese learner-facing status notes only. Do not mention code, JSON, schemas, prompts, chain-of-thought, or hidden reasoning. The final response must be valid JSON only.",
      };
    case "exercise_generation":
      return {
        maxOutputTokens: getEnvTokenLimit(
          "GEMINI_MAX_OUTPUT_TOKENS_EXERCISE",
          8192
        ),
        systemInstruction:
          "When progress notes are available, write short Vietnamese learner-facing status notes only. Do not mention code, JSON, schemas, prompts, chain-of-thought, or hidden reasoning. The final response must be valid JSON only.",
      };
    case "repair":
      return {
        maxOutputTokens: getEnvTokenLimit(
          "GEMINI_MAX_OUTPUT_TOKENS_REPAIR",
          16384
        ),
        temperature: 0.1,
        systemInstruction:
          "Repair the response into compact valid JSON only. Do not include markdown or commentary. Preserve the original meaning while fitting the requested schema.",
      };
  }
}
