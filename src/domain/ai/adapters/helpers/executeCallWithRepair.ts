import { getLogger } from "@/lib/logger";
import { LlmValidationError } from "./apiPoolTypes";
import { JsonParserService } from "../JsonParserService";
import type { Prompt } from "../../ports";
import type { CallRawOptions, CallRawResult } from "../../types";

const logger = getLogger("d.m.ai.GeminiRepair", "ai-provider");

export interface RepairOptions<T> {
  key: string;
  model: string;
  keyId: string | undefined;
  prompt: Prompt<T>;
  onThought: ((text: string) => Promise<void>) | undefined;
  callGeminiRaw: (opts: CallRawOptions) => Promise<CallRawResult>;
  accumulateTokens: (inTokens: number, outTokens: number) => void;
}

export async function executeCallWithRepair<T>(
  options: RepairOptions<T>
): Promise<T> {
  const {
    key,
    model,
    keyId,
    prompt,
    onThought,
    callGeminiRaw,
    accumulateTokens,
  } = options;

  let callResult;
  try {
    logger.trace(
      `[GeminiProvider] Raw prompt sent to model ${model} for purpose ${
        prompt.purpose
      }:\n${prompt.render()}`
    );
    callResult = await callGeminiRaw({
      apiKey: key,
      model,
      prompt: prompt.render(),
      purpose: prompt.purpose,
      zodSchema: prompt.schema,
      onThought: onThought,
    });
  } catch (err) {
    throw err;
  }
  accumulateTokens(callResult.inputTokens, callResult.outputTokens);

  const rawText = callResult.text;
  logger.trace(
    `[GeminiProvider] Raw text response received from model ${model} for purpose ${
      prompt.purpose
    }:\n${rawText}`
  );
  let parsed = null;

  try {
    const coerced = JsonParserService.parse(rawText, prompt.schemaVersion);
    parsed = prompt.schema.safeParse(coerced);
    if (parsed.success) {
      logger.debug(
        `[GeminiProvider] Successful validation on first attempt for key ID ${
          keyId || "env_key"
        }`
      );
      return parsed.data;
    } else {
      logger.warn(
        `[GeminiProvider] First attempt response validation failed for purpose ${
          prompt.purpose
        }. Errors: ${JSON.stringify(parsed.error.errors)}`
      );
    }
  } catch (parseErr: any) {
    logger.warn(
      `[GeminiProvider] First attempt JSON parsing/coercion failed for purpose ${
        prompt.purpose
      }: ${parseErr.message || parseErr}`
    );
  }

  // Trigger repair flow
  const expectedShape = prompt.expectedShape;
  const repairPromptText = [
    `Repair this ${prompt.schemaVersion} response into valid strict JSON only.`,
    "The top-level JSON value must be an object, not an array.",
    expectedShape
      ? `Expected JSON shape:\n${JSON.stringify(expectedShape)}`
      : undefined,
    "Keep the same meaning. Do not add markdown.",
    rawText,
  ]
    .filter(Boolean)
    .join("\n\n");

  logger.debug(
    `[GeminiProvider] Triggering repair flow using key ID ${keyId || "env_key"}`
  );
  logger.trace(`[GeminiProvider] Raw repair prompt sent:\n${repairPromptText}`);
  let repairResult;
  try {
    repairResult = await callGeminiRaw({
      apiKey: key,
      model,
      prompt: repairPromptText,
      purpose: "repair",
      zodSchema: prompt.schema,
    });
  } catch (err) {
    throw err;
  }
  accumulateTokens(repairResult.inputTokens, repairResult.outputTokens);

  logger.trace(
    `[GeminiProvider] Raw repair text response received:\n${repairResult.text}`
  );
  let coercedRepaired;
  try {
    coercedRepaired = JsonParserService.parse(
      repairResult.text,
      prompt.schemaVersion
    );
  } catch (parseErr: any) {
    logger.error(
      `[GeminiProvider] Repaired response JSON parsing failed: ${
        parseErr.message || parseErr
      }`
    );
    throw new LlmValidationError(
      `Repaired response JSON parsing failed: ${parseErr.message || parseErr}`,
      parseErr
    );
  }

  try {
    const finalData = prompt.schema.parse(coercedRepaired);
    logger.debug(
      `[GeminiProvider] Successful validation on repaired response for key ID ${
        keyId || "env_key"
      }`
    );
    return finalData;
  } catch (zodErr: any) {
    logger.error(
      `[GeminiProvider] Repaired response validation failed. Errors: ${JSON.stringify(
        zodErr.errors
      )}. Coerced: ${JSON.stringify(coercedRepaired)}`
    );
    throw new LlmValidationError(
      `Repaired response Zod validation failed: ${JSON.stringify(zodErr.errors)}`,
      zodErr
    );
  }
}
