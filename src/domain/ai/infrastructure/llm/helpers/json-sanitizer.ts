import { SCHEMA_VERSIONS } from "@/domain/constants";

export function stripNulls(obj: any): any {
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

export function sanitizeValue(val: any): any {
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val !== null && typeof val === "object") {
    const newObj: any = {};
    for (const key of Object.keys(val)) {
      newObj[key] = sanitizeValue(val[key]);
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

export function coerceJsonForSchema(
  input: unknown,
  schemaVersion: keyof typeof SCHEMA_VERSIONS
): any {
  const sanitized = sanitizeValue(input);
  const cleaned = stripNulls(sanitized);
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
  if (schemaVersion === "grading") {
    return coerceGradingSchema(cleaned);
  }
  return cleaned;
}

function coerceGradingSchema(cleaned: any): any {
  if (!cleaned || typeof cleaned !== "object" || Array.isArray(cleaned)) {
    return cleaned;
  }
  const record = { ...cleaned };

  // Clean top-level nulls/empty strings
  for (const key of [
    "naturalAnswer",
    "literalTranslationTrap",
    "errorType",
    "explanationVi",
  ] as const) {
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
