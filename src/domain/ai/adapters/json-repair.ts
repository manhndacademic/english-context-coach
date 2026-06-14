import { z } from "zod";
import { SCHEMA_VERSIONS } from "@/domain/constants";
import { getLogger } from "@/lib/logger";
import { repairPrompt } from "@/lib/ai/prompts";
import { AiError, extractJson, coerceJsonForSchema } from "./gemini-utils";

const logger = getLogger("d.m.ai.JsonRepairStrategy", "ai-provider");

export class JsonRepairStrategy {
  async execute<T>(
    options: {
      userId?: string;
      prompt: string;
      schemaVersion: string;
      schema: z.ZodType<T>;
      modelKind: "analysis" | "fast";
    },
    callGemini: (
      prompt: string,
      useOnThought: boolean
    ) => Promise<{
      text: string;
      inputTokens: number;
      outputTokens: number;
      model: string;
    }>
  ): Promise<{
    data: T;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    let resolvedModel = "";
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const {
          text: raw,
          inputTokens,
          outputTokens,
          model,
        } = await callGemini(options.prompt, true);

        resolvedModel = model;
        totalInputTokens = inputTokens;
        totalOutputTokens = outputTokens;

        let parsedJson: unknown;
        const extracted = extractJson(raw);
        try {
          parsedJson = coerceJsonForSchema(
            JSON.parse(extracted),
            options.schemaVersion as keyof typeof SCHEMA_VERSIONS
          );
        } catch (parseError) {
          logger.error(`JSON parsing failed on attempt ${attempt}.`);
          logger.error(`Raw response length: ${raw.length} characters.`);
          logger.error(`Raw response:\n---START---\n${raw}\n---END---`);
          logger.error(
            `Extracted string:\n---START---\n${extracted}\n---END---`
          );
          logger.error(`Parse error details:`, parseError);
          throw parseError;
        }

        const parsed = options.schema.safeParse(parsedJson);
        if (parsed.success) {
          return {
            data: parsed.data,
            model: resolvedModel,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          };
        }

        logger.warn(
          `Schema validation failed on attempt ${attempt}. Validation error: ${parsed.error.toString()}`
        );

        logger.info(`Attempting repair...`);
        const {
          text: repaired,
          inputTokens: repairIn,
          outputTokens: repairOut,
          model: repairModel,
        } = await callGemini(repairPrompt(raw, options.schemaVersion), false);

        resolvedModel = repairModel;
        totalInputTokens = repairIn;
        totalOutputTokens = repairOut;

        let repairedJson: unknown;
        const extractedRepaired = extractJson(repaired);
        try {
          repairedJson = coerceJsonForSchema(
            JSON.parse(extractedRepaired),
            options.schemaVersion as keyof typeof SCHEMA_VERSIONS
          );
        } catch (repairParseError) {
          logger.error(`Repaired JSON parsing failed.`);
          logger.error(
            `Repaired response length: ${repaired.length} characters.`
          );
          logger.error(
            `Repaired response:\n---START---\n${repaired}\n---END---`
          );
          logger.error(
            `Extracted repaired string:\n---START---\n${extractedRepaired}\n---END---`
          );
          logger.error(`Repair parse error details:`, repairParseError);
          throw repairParseError;
        }

        const repairedParsed = options.schema.safeParse(repairedJson);
        if (repairedParsed.success) {
          return {
            data: repairedParsed.data,
            model: resolvedModel,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          };
        }

        logger.warn(
          `Repair schema validation failed on attempt ${attempt}. Validation error: ${repairedParsed.error.toString()}`
        );

        if (attempt === 2) {
          throw new AiError(
            "AI returned JSON that did not match the expected schema after repair.",
            "invalid_json_schema"
          );
        }
      } catch (innerError) {
        if (attempt === 2) {
          throw innerError;
        }
        logger.warn(
          `Retryable operation failed on attempt ${attempt}. Retrying...`
        );
      }
    }

    throw new AiError(
      "AI returned JSON that did not match the expected schema after retry.",
      "invalid_json_schema"
    );
  }
}
