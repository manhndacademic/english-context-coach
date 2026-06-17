const getSourceTextMaxLength = () => {
  const envVal =
    process.env.NEXT_PUBLIC_SOURCE_TEXT_MAX_LENGTH ||
    process.env.SOURCE_TEXT_MAX_LENGTH;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return 8_000;
};

export const SOURCE_TEXT_MAX_LENGTH = getSourceTextMaxLength();
export const MIN_PASSWORD_LENGTH = 12;
export const MIN_LESSON_ITEMS = 3;
export const MAX_LESSON_ITEMS = 7;
export const PROMPT_VERSIONS = {
  analysis: "analysis-v3",
  exercises: "exercises-v1",
  grading: "grading-v2",
  review_prompt: "review_prompt-v1",
} as const;

export const SCHEMA_VERSIONS = {
  analysis: "analysis-schema-v1",
  exercises: "exercises-schema-v1",
  grading: "grading-schema-v1",
  review_prompt: "review_prompt-schema-v1",
} as const;
