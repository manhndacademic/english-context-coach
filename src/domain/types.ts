export type KeyPhraseCategory =
  | "idiom"
  | "phrasal_verb"
  | "technical_term"
  | "collocation"
  | "grammar_pattern"
  | "business_phrase"
  | "general_phrase";

export type UserErrorType =
  | "literal_translation"
  | "phrase_misunderstanding"
  | "technical_term_misunderstanding"
  | "phrasal_verb_error"
  | "collocation_error"
  | "grammar_structure_misread"
  | "pronoun_reference_misread"
  | "tone_register_misread"
  | "missing_context";

export type ExerciseType =
  | "meaning_choice"
  | "cloze_phrase"
  | "natural_translation"
  | "focus_question"
  | "trap_choice"
  | "phrase_production"
  | "dialogue_completion"
  | "register_shift"
  | "trap_detect";

export type Timeframe = "today" | "7days" | "30days";

export type GenerationStatus = "pending" | "running" | "succeeded" | "failed";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type MistakePatternSource = "mistake" | "phrase" | "manual";

export type LessonFocusCategory = "tone" | "structure" | "purpose" | "context";

export type DiffType = "equal" | "delete" | "insert";

export type ExercisePracticeStatus = "solved" | "retry" | "target";

export type AppTheme = "light" | "dark" | "system";

export type MistakePatternStatus = "new" | "repeated" | "none";

export type ReviewPromptJobState =
  | { status: "processed"; patternId: string; success: boolean }
  | { status: "idle" }
  | { status: "failed"; error: string };

export type AiPurpose =
  | "analysis"
  | "exercise_generation"
  | "grading"
  | "repair";

export type AiRequestStatus = "succeeded" | "failed";

export type AiModelKind = "analysis" | "fast";

export type LessonViewMode = "standard" | "grammar";

export type DiffViewMode = "unified" | "split";
