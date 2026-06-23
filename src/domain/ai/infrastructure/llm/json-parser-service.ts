import { SCHEMA_VERSIONS } from "@/domain/constants";
import { extractJson as helperExtract } from "./helpers/json-extractor";
import { repairJson as helperRepair } from "./helpers/json-repair-rules";
import { coerceJsonForSchema as helperCoerce } from "./helpers/json-sanitizer";

export class JsonParserService {
  /**
   * Parses the raw LLM response text into a coerced schema-compatible object.
   * Runs the self-healing pipeline before calling JSON.parse.
   */
  static parse<T>(rawText: string, schemaVersion: string): T {
    // Fast path: try JSON.parse directly first (structured output usually returns valid JSON)
    try {
      const fastParsed = JSON.parse(rawText);
      const shortVersion = schemaVersion.split(
        "-"
      )[0] as keyof typeof SCHEMA_VERSIONS;
      const coerced = helperCoerce(fastParsed, shortVersion);
      return coerced as T;
    } catch {
      // Fall through to repair pipeline
    }
    // Fallback: repair pipeline
    const extracted = helperExtract(rawText);
    const repaired = helperRepair(extracted);
    const parsedObj = JSON.parse(repaired);
    const shortVersion = schemaVersion.split(
      "-"
    )[0] as keyof typeof SCHEMA_VERSIONS;
    return helperCoerce(parsedObj, shortVersion) as T;
  }

  /**
   * Trims the string and finds the outermost curly braces `{}` or square brackets `[]`
   * representing the JSON block, extracting it from any surrounding Markdown.
   */
  static extractJson(text: string): string {
    return helperExtract(text);
  }

  /**
   * Performs a single state-aware pass to:
   * 1. Escape control characters (newlines, carriage returns, tabs) inside strings.
   * 2. Strip trailing commas (commas followed by closing braces/brackets) outside strings.
   * 3. Escape internal unescaped quotes inside string values.
   */
  static repairJson(str: string): string {
    return helperRepair(str);
  }

  /**
   * Coerces parsed JSON blocks into expected schemas to accommodate LLM variations.
   */
  static coerceJsonForSchema(
    input: unknown,
    schemaVersion: keyof typeof SCHEMA_VERSIONS
  ): any {
    return helperCoerce(input, schemaVersion);
  }
}
