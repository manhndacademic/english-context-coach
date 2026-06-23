import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { sourceTexts } from "./source-texts";
import {
  levelEnum,
  phraseCategoryEnum,
  errorTypeEnum,
  formalityEnum,
  stageStatusEnum,
} from "./enums";

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
    formality: formalityEnum("formality"),
    suggestedText: text("suggested_text"),
    inputMode: text("input_mode").notNull().default("understand_and_practice"),
    detectedLevel: levelEnum("detected_level"),
    summaryVi: text("summary_vi"),
    naturalTranslationVi: text("natural_translation_vi"),
    contextExplanationVi: text("context_explanation_vi"),
    analysisStatus: stageStatusEnum("analysis_status")
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
  (table) => [
    uniqueIndex("lessons_source_version_unique").on(
      table.sourceTextId,
      table.version
    ),
    index("lessons_user_idx").on(table.userId),
  ]
);

// We need textTypeEnum for lessons table text_type column
import { textTypeEnum } from "./enums";

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
    culturalNoteVi: text("cultural_note_vi"),
    exampleEn: text("example_en").notNull(),
    exampleVi: text("example_vi").notNull(),
    category: phraseCategoryEnum("category").notNull(),
    errorType: errorTypeEnum("error_type").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    isRejected: boolean("is_rejected").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("correction_items_lesson_idx").on(table.lessonId)]
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
  (table) => [
    index("sentence_breakdowns_lesson_idx").on(
      table.lessonId,
      table.orderIndex
    ),
  ]
);

import { jsonb } from "drizzle-orm/pg-core";

export type Lesson = typeof lessons.$inferSelect;
export type SentenceBreakdown = typeof sentenceBreakdowns.$inferSelect;
export type CorrectionItem = typeof correctionItems.$inferSelect;
