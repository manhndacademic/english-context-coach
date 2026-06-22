import { pgEnum } from "drizzle-orm/pg-core";

export const textTypeEnum = pgEnum("text_type", [
  "work_message",
  "technical_doc",
  "email",
  "article",
  "academic",
  "general",
  "unknown",
  "chat_message",
  "ticket",
  "code_review",
  "meeting_notes",
]);

export const formalityEnum = pgEnum("formality", [
  "formal",
  "semi_formal",
  "casual",
]);

export const levelEnum = pgEnum("detected_level", ["A2", "B1", "B2", "C1"]);

export const phraseCategoryEnum = pgEnum("phrase_category", [
  "idiom",
  "phrasal_verb",
  "technical_term",
  "collocation",
  "grammar_pattern",
  "business_phrase",
  "general_phrase",
]);

export const lessonFocusCategoryEnum = pgEnum("lesson_focus_category", [
  "tone",
  "structure",
  "purpose",
  "context",
]);

export const exerciseTypeEnum = pgEnum("exercise_type", [
  "meaning_choice",
  "cloze_phrase",
  "natural_translation",
  "focus_question",
  "trap_choice",
  "phrase_production",
  "dialogue_completion",
  "register_shift",
  "trap_detect",
]);

export const errorTypeEnum = pgEnum("error_type", [
  "literal_translation",
  "phrase_misunderstanding",
  "technical_term_misunderstanding",
  "phrasal_verb_error",
  "collocation_error",
  "grammar_structure_misread",
  "pronoun_reference_misread",
  "tone_register_misread",
  "missing_context",
]);

export const masteryStateEnum = pgEnum("mastery_state", ["active", "mastered"]);

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export const stageStatusEnum = pgEnum("stage_status", [
  "idle",
  "pending",
  "running",
  "succeeded",
  "failed",
]);

export const generationMilestoneCodeEnum = pgEnum("generation_milestone_code", [
  "queued",
  "claimed",
  "analysis_started",
  "analysis_saved",
  "exercises_started",
  "exercises_saved",
  "completed",
  "failed",
]);

export const aiPurposeEnum = pgEnum("ai_purpose", [
  "analysis",
  "exercise_generation",
  "grading",
  "repair",
]);

export const userStatusEnum = pgEnum("user_status", [
  "pending",
  "approved",
  "rejected",
]);
