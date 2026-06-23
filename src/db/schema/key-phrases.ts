import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { lessons } from "./lessons";
import {
  phraseCategoryEnum,
  levelEnum,
  lessonFocusCategoryEnum,
} from "./enums";

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
  (table) => [index("key_phrases_lesson_idx").on(table.lessonId)]
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
  (table) => [index("lesson_focuses_lesson_idx").on(table.lessonId)]
);

export type KeyPhrase = typeof keyPhrases.$inferSelect;
export type LessonFocus = typeof lessonFocuses.$inferSelect;
