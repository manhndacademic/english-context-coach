import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { lessons, correctionItems } from "./lessons";
import { keyPhrases, lessonFocuses } from "./key-phrases";
import { exerciseTypeEnum } from "./enums";

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
  (table) => [index("exercises_lesson_idx").on(table.lessonId)]
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
  (table) => [
    index("attempts_exercise_idx").on(table.exerciseId),
    index("attempts_user_idx").on(table.userId),
    index("attempts_lesson_idx").on(table.lessonId),
  ]
);

export type Exercise = typeof exercises.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
