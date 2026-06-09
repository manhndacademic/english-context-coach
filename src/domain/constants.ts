export const SOURCE_TEXT_MAX_LENGTH = 8_000;
export const MIN_PASSWORD_LENGTH = 12;
export const MIN_LESSON_ITEMS = 3;
export const MAX_LESSON_ITEMS = 7;
export const PROMPT_VERSIONS = {
  analysis: "analysis-v2",
  exercises: "exercises-v1",
  grading: "grading-v1",
} as const;

export const SCHEMA_VERSIONS = {
  analysis: "analysis-schema-v1",
  exercises: "exercises-schema-v1",
  grading: "grading-schema-v1",
} as const;
