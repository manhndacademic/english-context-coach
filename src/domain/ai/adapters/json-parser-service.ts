import { SCHEMA_VERSIONS } from "@/domain/constants";

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
      const coerced = JsonParserService.coerceJsonForSchema(
        fastParsed,
        shortVersion
      );
      return coerced as T;
    } catch {
      // Fall through to repair pipeline
    }
    // Fallback: repair pipeline
    const extracted = JsonParserService.extractJson(rawText);
    const repaired = JsonParserService.repairJson(extracted);
    const parsedObj = JSON.parse(repaired);
    const shortVersion = schemaVersion.split(
      "-"
    )[0] as keyof typeof SCHEMA_VERSIONS;
    return JsonParserService.coerceJsonForSchema(parsedObj, shortVersion) as T;
  }

  /**
   * Trims the string and finds the outermost curly braces `{}` or square brackets `[]`
   * representing the JSON block, extracting it from any surrounding Markdown.
   */
  static extractJson(text: string): string {
    const trimmed = text.trim();
    let candidate = trimmed;
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
      candidate = match?.[1]?.trim() ?? trimmed;
    }
    return JsonParserService.cleanJsonString(candidate);
  }

  /**
   * Helper that tracks brace/bracket balance to locate the exact JSON block boundary.
   */
  private static cleanJsonString(str: string): string {
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

  /**
   * Performs a single state-aware pass to:
   * 1. Escape control characters (newlines, carriage returns, tabs) inside strings.
   * 2. Strip trailing commas (commas followed by closing braces/brackets) outside strings.
   * 3. Escape internal unescaped quotes inside string values.
   */
  static repairJson(str: string): string {
    let inString = false;
    let escaped = false;
    let result = "";

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (escaped) {
        escaped = false;
        result += char;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        result += char;
        continue;
      }

      if (char === '"') {
        if (inString) {
          // Look ahead to check if this quote is a valid separator: , } ] :
          let nextChar = "";
          let nextIdx = i + 1;
          while (nextIdx < str.length) {
            const c = str[nextIdx];
            if (c !== " " && c !== "\n" && c !== "\r" && c !== "\t") {
              nextChar = c;
              break;
            }
            nextIdx++;
          }

          const isClosing =
            nextChar === "," ||
            nextChar === "}" ||
            nextChar === "]" ||
            nextChar === ":" ||
            nextChar === "";

          if (isClosing) {
            inString = false;
            result += char;
          } else {
            // Unescaped internal quote! Escape it.
            result += '\\"';
          }
        } else {
          inString = true;
          result += char;
        }
        continue;
      }

      if (inString) {
        if (char === "\n") {
          result += "\\n";
        } else if (char === "\r") {
          result += "\\r";
        } else if (char === "\t") {
          result += "\\t";
        } else {
          result += char;
        }
      } else {
        if (char === ",") {
          // Look ahead: if the next non-whitespace char is } or ], this is a trailing comma!
          let nextChar = "";
          let nextIdx = i + 1;
          while (nextIdx < str.length) {
            const c = str[nextIdx];
            if (c !== " " && c !== "\n" && c !== "\r" && c !== "\t") {
              nextChar = c;
              break;
            }
            nextIdx++;
          }

          if (nextChar === "}" || nextChar === "]") {
            continue; // Skip trailing comma
          }
        }
        result += char;
      }
    }

    return result;
  }

  /**
   * Recursively strips null values from an object.
   */
  private static stripNulls(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(JsonParserService.stripNulls);
    }
    if (obj !== null && typeof obj === "object") {
      const newObj: any = {};
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val !== null) {
          newObj[key] = JsonParserService.stripNulls(val);
        }
      }
      return newObj;
    }
    return obj;
  }

  /**
   * Recursively sanitizes string values in an object/array.
   * - Strips HTML tags completely.
   * - Cleans up suffix/prefix technical noise like "(null)null,", "nullnull", etc.
   * - Converts literal string placeholders like "null", "undefined", "(null)" to null.
   */
  private static sanitizeValue(val: any): any {
    if (Array.isArray(val)) {
      return val.map(JsonParserService.sanitizeValue);
    }
    if (val !== null && typeof val === "object") {
      const newObj: any = {};
      for (const key of Object.keys(val)) {
        newObj[key] = JsonParserService.sanitizeValue(val[key]);
      }
      return newObj;
    }
    if (typeof val === "string") {
      // 1. Strip HTML tags
      let cleaned = val.replace(/<[^>]*>/g, "");

      // 2. Remove trailing/leading garbage like "(null)null,", "nullnull", "(null)"
      cleaned = cleaned.replace(/\s*\(?null\)?\s*\(?null\)?\s*,?\s*$/i, "");
      cleaned = cleaned.replace(/^\s*\(?null\)?\s*\(?null\)?\s*,?\s*/i, "");

      // 3. Remove swallowed JSON fields
      const technicalKeys = [
        "literalTranslationTrap",
        "literalTrap",
        "feedbackDetails",
        "error",
        "score",
        "isCorrect",
        "feedbackVi",
        "naturalAnswer",
        "whatWasWrong",
        "whyItWasWrong",
        "correctUnderstanding",
        "detailedExplanation",
        "mistakeType",
        "nextPracticeItem",
      ];
      const technicalKeysRegex = new RegExp(
        `\\b(${technicalKeys.join("|")})\\b\\s*:\\s*[\\s\\S]*$`,
        "i"
      );
      if (technicalKeysRegex.test(cleaned)) {
        cleaned = cleaned.replace(technicalKeysRegex, "").trim();
        // Clean up any trailing formatting remnants left from swallowed JSON (e.g. commas, braces, quotes, backslashes)
        cleaned = cleaned.replace(/[,\\\{\}\[\]"'\s]+$/, "").trim();
      }

      const lower = cleaned.trim().toLowerCase();
      if (
        lower === "null" ||
        lower === "undefined" ||
        lower === "(null)" ||
        lower === "none" ||
        cleaned.trim() === ""
      ) {
        return null;
      }
      return cleaned.trim();
    }
    return val;
  }

  /**
   * Coerces parsed JSON blocks into expected schemas to accommodate LLM variations.
   */
  static coerceJsonForSchema(
    input: unknown,
    schemaVersion: keyof typeof SCHEMA_VERSIONS
  ): any {
    const sanitized = JsonParserService.sanitizeValue(input);
    const cleaned = JsonParserService.stripNulls(sanitized);
    if (schemaVersion === "exercises" && Array.isArray(cleaned)) {
      return { exercises: cleaned };
    }
    if (
      (schemaVersion === "analysis" || schemaVersion === "grading") &&
      Array.isArray(cleaned) &&
      cleaned.length === 1
    ) {
      return cleaned[0];
    }
    if (
      schemaVersion === "grading" &&
      cleaned &&
      typeof cleaned === "object" &&
      !Array.isArray(cleaned)
    ) {
      const record = { ...(cleaned as Record<string, any>) };

      // Clean top-level nulls/empty strings
      for (const key of [
        "naturalAnswer",
        "literalTranslationTrap",
        "errorType",
        "explanationVi",
      ] as const) {
        if (
          record[key] === null ||
          record[key] === "" ||
          record[key] === "none"
        ) {
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
          for (const key of [
            "errorType",
            "explanationVi",
            "targetItem",
          ] as const) {
            if (
              errorObj[key] === null ||
              errorObj[key] === "" ||
              errorObj[key] === "none"
            ) {
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
}
