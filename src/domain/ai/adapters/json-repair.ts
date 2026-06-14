import { z } from "zod";
import { SCHEMA_VERSIONS } from "@/domain/constants";
import { getLogger } from "@/lib/logger";
import { repairPrompt } from "@/lib/ai/prompts";
import { AiError, extractJson, coerceJsonForSchema } from "./gemini-utils";

const logger = getLogger("d.m.ai.JsonRepairStrategy", "ai-provider");
const LOG_PREVIEW_LIMIT = 2000;

function preview(value: string) {
  if (value.length <= LOG_PREVIEW_LIMIT) return value;
  const half = Math.floor(LOG_PREVIEW_LIMIT / 2);
  return `${value.slice(0, half)}\n---TRUNCATED ${value.length - LOG_PREVIEW_LIMIT} chars---\n${value.slice(-half)}`;
}

export class JsonRepairStrategy {
  async execute<T>(
    options: {
      userId?: string;
      purpose?: "analysis" | "exercise_generation" | "grading" | "repair";
      prompt: string;
      schemaVersion: string;
      schema: z.ZodType<T>;
      modelKind: "analysis" | "fast";
    },
    callGemini: (
      prompt: string,
      useOnThought: boolean,
      purposeOverride?:
        | "analysis"
        | "exercise_generation"
        | "grading"
        | "repair"
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
    const useThoughtsForMainRequest = options.purpose !== "grading";

    const repairAndValidate = async (raw: string, reason: string) => {
      logger.info(`Attempting JSON repair after ${reason}...`);
      const {
        text: repaired,
        inputTokens: repairIn,
        outputTokens: repairOut,
        model: repairModel,
      } = await callGemini(
        repairPrompt(raw, options.schemaVersion),
        false,
        "repair"
      );

      // Keep the final model for cost attribution consistency; token totals are cumulative.
      resolvedModel = repairModel;
      totalInputTokens += repairIn;
      totalOutputTokens += repairOut;

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
          `Repaired response preview:\n---START---\n${preview(repaired)}\n---END---`
        );
        logger.error(
          `Extracted repaired length: ${extractedRepaired.length} characters.`
        );
        logger.error(
          `Extracted repaired preview:\n---START---\n${preview(extractedRepaired)}\n---END---`
        );
        logger.error(`Repair parse error details:`, repairParseError);
        throw repairParseError;
      }

      const repairedParsed = options.schema.safeParse(repairedJson);
      if (repairedParsed.success) {
        return repairedParsed.data;
      }

      logger.warn(
        `Repair schema validation failed. Validation error: ${repairedParsed.error.toString()}`
      );
      throw new AiError(
        "AI returned JSON that did not match the expected schema after repair.",
        "invalid_json_schema"
      );
    };

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const {
          text: raw,
          inputTokens,
          outputTokens,
          model,
        } = await callGemini(options.prompt, useThoughtsForMainRequest);

        resolvedModel = model;
        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;

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
          logger.error(
            `Extracted string length: ${extracted.length} characters.`
          );
          logger.error(
            `Raw response preview:\n---START---\n${preview(raw)}\n---END---`
          );
          logger.error(
            `Extracted string preview:\n---START---\n${preview(extracted)}\n---END---`
          );
          logger.error(`Parse error details:`, parseError);
          const data = await repairAndValidate(raw, "parse failure");
          return {
            data,
            model: resolvedModel,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          };
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

        const data = await repairAndValidate(raw, "schema validation failure");
        return {
          data,
          model: resolvedModel,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        };
      } catch (innerError) {
        if (attempt === 2) {
          throw innerError;
        }
        logger.warn(
          `Repair/retry flow failed on attempt ${attempt}. Retrying original prompt once...`
        );
      }
    }

    throw new AiError(
      "AI returned JSON that did not match the expected schema after retry.",
      "invalid_json_schema"
    );
  }
}
