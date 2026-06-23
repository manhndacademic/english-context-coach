import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { lessons, correctionItems } from "./lessons";
import { keyPhrases, lessonFocuses } from "./key-phrases";
import { attempts } from "./exercises";
import { errorTypeEnum } from "./enums";

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
  (table) => [
    index("user_errors_user_idx").on(table.userId),
    index("user_errors_lesson_idx").on(table.lessonId),
  ]
);

export type UserError = typeof userErrors.$inferSelect;
