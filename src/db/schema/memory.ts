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
  real,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { keyPhrases } from "./lessons";
import {
  phraseCategoryEnum,
  errorTypeEnum,
  masteryStateEnum,
  jobStatusEnum,
} from "./enums";

export const mistakePatterns = pgTable(
  "mistake_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conceptKey: text("concept_key").notNull(),
    normalizedPhrase: text("normalized_phrase").notNull(),
    senseKey: text("sense_key"),
    category: phraseCategoryEnum("category").notNull(),
    errorType: errorTypeEnum("error_type").notNull(),
    meaningVi: text("meaning_vi").notNull(),
    safeReviewPromptVi: text("safe_review_prompt_vi").notNull(),
    reviewPromptEn: text("review_prompt_en"),
    reviewPromptVi: text("review_prompt_vi"),
    reviewRubricVi: text("review_rubric_vi"),
    reviewCorrectAnswer: text("review_correct_answer"),
    reviewAcceptableAnswers: jsonb("review_acceptable_answers").$type<
      string[]
    >(),
    reviewType: text("review_type").notNull().default("natural_translation"),
    reviewChoices: jsonb("review_choices").$type<string[]>(),
    reviewPromptStatus: jobStatusEnum("review_prompt_status")
      .notNull()
      .default("succeeded"),
    reviewPromptAttempts: integer("review_prompt_attempts")
      .notNull()
      .default(0),
    reviewPromptError: text("review_prompt_error"),
    reviewPromptLockedAt: timestamp("review_prompt_locked_at", {
      mode: "date",
    }),
    reviewPromptLockedBy: text("review_prompt_locked_by"),
    draftPhrase: text("draft_phrase"),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    intervalDays: integer("interval_days").notNull().default(0),
    easeFactor: real("ease_factor").notNull().default(2.5),
    repetitions: integer("repetitions").notNull().default(0),
    masteryState: masteryStateEnum("mastery_state").notNull().default("active"),
    dueAt: timestamp("due_at", { mode: "date" }).notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { mode: "date" }),
    isSensitive: boolean("is_sensitive").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    aggregateUnique: uniqueIndex("mistake_patterns_aggregate_unique").on(
      table.userId,
      table.conceptKey,
      table.errorType
    ),
    dueIdx: index("mistake_patterns_due_idx").on(
      table.userId,
      table.masteryState,
      table.dueAt
    ),
  })
);

export const phrasePractices = pgTable(
  "phrase_practices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    keyPhraseId: uuid("key_phrase_id").references(() => keyPhrases.id, {
      onDelete: "set null",
    }),
    conceptKey: text("concept_key").notNull(),
    normalizedPhrase: text("normalized_phrase").notNull(),
    senseKey: text("sense_key").notNull(),
    category: phraseCategoryEnum("category").notNull(),
    meaningVi: text("meaning_vi").notNull(),
    draftPhrase: text("draft_phrase"),
    safeReviewPromptVi: text("safe_review_prompt_vi").notNull(),
    reviewPromptEn: text("review_prompt_en"),
    reviewPromptVi: text("review_prompt_vi"),
    reviewRubricVi: text("review_rubric_vi"),
    reviewCorrectAnswer: text("review_correct_answer"),
    reviewAcceptableAnswers: jsonb("review_acceptable_answers").$type<
      string[]
    >(),
    reviewType: text("review_type").notNull().default("natural_translation"),
    reviewChoices: jsonb("review_choices").$type<string[]>(),
    reviewPromptStatus: jobStatusEnum("review_prompt_status")
      .notNull()
      .default("succeeded"),
    reviewPromptAttempts: integer("review_prompt_attempts")
      .notNull()
      .default(0),
    reviewPromptError: text("review_prompt_error"),
    reviewPromptLockedAt: timestamp("review_prompt_locked_at", {
      mode: "date",
    }),
    reviewPromptLockedBy: text("review_prompt_locked_by"),
    intervalDays: integer("interval_days").notNull().default(0),
    easeFactor: real("ease_factor").notNull().default(2.5),
    repetitions: integer("repetitions").notNull().default(0),
    masteryState: masteryStateEnum("mastery_state").notNull().default("active"),
    dueAt: timestamp("due_at", { mode: "date" }).notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { mode: "date" }),
    isSensitive: boolean("is_sensitive").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    aggregateUnique: uniqueIndex("phrase_practices_aggregate_unique").on(
      table.userId,
      table.conceptKey,
      table.senseKey
    ),
    dueIdx: index("phrase_practices_due_idx").on(
      table.userId,
      table.masteryState,
      table.dueAt
    ),
  })
);

export const reviewAttempts = pgTable(
  "review_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mistakePatternId: uuid("mistake_pattern_id")
      .notNull()
      .references(() => mistakePatterns.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    score: integer("score").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    feedbackVi: text("feedback_vi").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("review_attempts_user_idx").on(table.userId),
    patternIdx: index("review_attempts_pattern_idx").on(table.mistakePatternId),
  })
);

export type ReviewAttempt = typeof reviewAttempts.$inferSelect;

export const phrasePracticeAttempts = pgTable(
  "phrase_practice_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    phrasePracticeId: uuid("phrase_practice_id")
      .notNull()
      .references(() => phrasePractices.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    score: integer("score").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    feedbackVi: text("feedback_vi").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("phrase_practice_attempts_user_idx").on(table.userId),
    practiceIdx: index("phrase_practice_attempts_practice_idx").on(
      table.phrasePracticeId
    ),
  })
);

export type PhrasePracticeAttempt = typeof phrasePracticeAttempts.$inferSelect;
export type MistakePattern = typeof mistakePatterns.$inferSelect;
export type PhrasePractice = typeof phrasePractices.$inferSelect;
