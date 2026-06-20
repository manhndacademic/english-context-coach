import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import {
  textTypeEnum,
  levelEnum,
  phraseCategoryEnum,
  lessonFocusCategoryEnum,
  exerciseTypeEnum,
  errorTypeEnum,
} from "./enums";

export const sourceTexts = pgTable(
  "source_texts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("source_texts_user_idx").on(table.userId),
  })
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceTextId: uuid("source_text_id")
      .notNull()
      .references(() => sourceTexts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    textType: textTypeEnum("text_type").notNull().default("unknown"),
    inputMode: text("input_mode").notNull().default("understand_and_practice"),
    detectedLevel: levelEnum("detected_level"),
    summaryVi: text("summary_vi"),
    naturalTranslationVi: text("natural_translation_vi"),
    contextExplanationVi: text("context_explanation_vi"),
    analysisStatus: stageStatusEnum("analysis_status") // wait, stageStatusEnum is in enums
      .notNull()
      .default("pending"),
    exerciseStatus: stageStatusEnum("exercise_status")
      .notNull()
      .default("idle"),
    analysisPromptVersion: text("analysis_prompt_version"),
    exercisePromptVersion: text("exercise_prompt_version"),
    gradingPromptVersion: text("grading_prompt_version"),
    analysisModel: text("analysis_model"),
    exerciseModel: text("exercise_model"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    sourceVersionUnique: uniqueIndex("lessons_source_version_unique").on(
      table.sourceTextId,
      table.version
    ),
    userIdx: index("lessons_user_idx").on(table.userId),
  })
);

import { stageStatusEnum } from "./enums";

export const draftTexts = pgTable(
  "draft_texts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceTextId: uuid("source_text_id")
      .notNull()
      .references(() => sourceTexts.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("draft_texts_user_idx").on(table.userId),
    sourceTextIdx: index("draft_texts_source_text_idx").on(table.sourceTextId),
  })
);

export const correctionItems = pgTable(
  "correction_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    draftPhrase: text("draft_phrase").notNull(),
    correctedPhrase: text("corrected_phrase").notNull(),
    explanationVi: text("explanation_vi").notNull(),
    literalTrapVi: text("literal_trap_vi"),
    exampleEn: text("example_en").notNull(),
    exampleVi: text("example_vi").notNull(),
    category: phraseCategoryEnum("category").notNull(),
    errorType: errorTypeEnum("error_type").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    lessonIdx: index("correction_items_lesson_idx").on(table.lessonId),
  })
);

export const keyPhrases = pgTable(
  "key_phrases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    phrase: text("phrase").notNull(),
    conceptKey: text("concept_key").notNull(),
    conceptPhrase: text("concept_phrase").notNull(),
    conceptMeaningVi: text("concept_meaning_vi").notNull(),
    normalizedPhrase: text("normalized_phrase").notNull(),
    senseKey: text("sense_key").notNull(),
    meaningVi: text("meaning_vi").notNull(),
    meaningInContextVi: text("meaning_in_context_vi").notNull(),
    examples: jsonb("examples")
      .$type<{ exampleEn: string; exampleVi: string; ipa?: string }[]>()
      .default([])
      .notNull(),
    literalTranslationVi: text("literal_translation_vi"),
    naturalTranslationVi: text("natural_translation_vi"),
    whyConfusingVi: text("why_confusing_vi"),
    ipa: text("ipa"),
    category: phraseCategoryEnum("category").notNull(),
    difficulty: levelEnum("difficulty").notNull(),
    isSensitive: boolean("is_sensitive").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    lessonIdx: index("key_phrases_lesson_idx").on(table.lessonId),
  })
);

export const sentenceBreakdowns = pgTable(
  "sentence_breakdowns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sentence: text("sentence").notNull(),
    correctedSentenceEn: text("corrected_sentence_en"),
    diffSpans: jsonb("diff_spans"),
    naturalMeaningVi: text("natural_meaning_vi").notNull(),
    structureNotesVi: text("structure_notes_vi").notNull(),
    toneOrContextVi: text("tone_or_context_vi"),
    ipa: text("ipa"),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    lessonIdx: index("sentence_breakdowns_lesson_idx").on(
      table.lessonId,
      table.orderIndex
    ),
  })
);

export const lessonFocuses = pgTable(
  "lesson_focuses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    conceptKey: text("concept_key").notNull(),
    conceptPhrase: text("concept_phrase").notNull(),
    conceptMeaningVi: text("concept_meaning_vi").notNull(),
    category: lessonFocusCategoryEnum("category").notNull(),
    explanationVi: text("explanation_vi").notNull(),
    difficulty: levelEnum("difficulty").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    lessonIdx: index("lesson_focuses_lesson_idx").on(table.lessonId),
  })
);

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    keyPhraseId: uuid("key_phrase_id").references(() => keyPhrases.id, {
      onDelete: "set null",
    }),
    lessonFocusId: uuid("lesson_focus_id").references(() => lessonFocuses.id, {
      onDelete: "set null",
    }),
    correctionItemId: uuid("correction_item_id").references(
      () => correctionItems.id,
      {
        onDelete: "set null",
      }
    ),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: exerciseTypeEnum("type").notNull(),
    promptVi: text("prompt_vi").notNull(),
    promptEn: text("prompt_en"),
    choices: jsonb("choices").$type<string[]>(),
    correctAnswer: text("correct_answer"),
    acceptableAnswers: jsonb("acceptable_answers").$type<string[]>(),
    rubricVi: text("rubric_vi"),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    lessonIdx: index("exercises_lesson_idx").on(table.lessonId),
  })
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    score: integer("score").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    feedbackVi: text("feedback_vi").notNull(),
    gradingMetadata: jsonb("grading_metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    exerciseIdx: index("attempts_exercise_idx").on(table.exerciseId),
    userIdx: index("attempts_user_idx").on(table.userId),
    lessonIdx: index("attempts_lesson_idx").on(table.lessonId),
  })
);

export const userErrors = pgTable(
  "user_errors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id").references(() => attempts.id, {
      onDelete: "set null",
    }),
    lessonId: uuid("lesson_id").references(() => lessons.id, {
      onDelete: "set null",
    }),
    keyPhraseId: uuid("key_phrase_id").references(() => keyPhrases.id, {
      onDelete: "set null",
    }),
    lessonFocusId: uuid("lesson_focus_id").references(() => lessonFocuses.id, {
      onDelete: "set null",
    }),
    correctionItemId: uuid("correction_item_id").references(
      () => correctionItems.id,
      {
        onDelete: "set null",
      }
    ),
    errorType: errorTypeEnum("error_type").notNull(),
    conceptKey: text("concept_key").notNull(),
    normalizedPhrase: text("normalized_phrase").notNull(),
    senseKey: text("sense_key").notNull(),
    explanationVi: text("explanation_vi").notNull(),
    isSourceSensitive: boolean("is_source_sensitive").notNull().default(false),
    isRepeated: boolean("is_repeated").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("user_errors_user_idx").on(table.userId),
    lessonIdx: index("user_errors_lesson_idx").on(table.lessonId),
  })
);

export type SourceText = typeof sourceTexts.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type KeyPhrase = typeof keyPhrases.$inferSelect;
export type SentenceBreakdown = typeof sentenceBreakdowns.$inferSelect;
export type LessonFocus = typeof lessonFocuses.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type UserError = typeof userErrors.$inferSelect;
