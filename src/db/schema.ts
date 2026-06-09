import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const textTypeEnum = pgEnum("text_type", [
  "work_message",
  "technical_doc",
  "email",
  "article",
  "academic",
  "general",
  "unknown",
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

export const exerciseTypeEnum = pgEnum("exercise_type", [
  "meaning_choice",
  "cloze_phrase",
  "natural_translation",
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

export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "succeeded", "failed"]);
export const stageStatusEnum = pgEnum("stage_status", ["pending", "running", "succeeded", "failed"]);
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
export const aiPurposeEnum = pgEnum("ai_purpose", ["analysis", "exercise_generation", "grading", "repair"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  }),
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => ({
    compositePk: primaryKey({ columns: [verificationToken.identifier, verificationToken.token] }),
  }),
);

export const authenticators = pgTable(
  "authenticators",
  {
    credentialID: text("credential_id").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("provider_account_id").notNull(),
    credentialPublicKey: text("credential_public_key").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credential_device_type").notNull(),
    credentialBackedUp: boolean("credential_backed_up").notNull(),
    transports: text("transports"),
  },
  (authenticator) => ({
    compositePK: primaryKey({ columns: [authenticator.userId, authenticator.credentialID] }),
  }),
);

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
  }),
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
    detectedLevel: levelEnum("detected_level"),
    summaryVi: text("summary_vi"),
    naturalTranslationVi: text("natural_translation_vi"),
    contextExplanationVi: text("context_explanation_vi"),
    analysisStatus: stageStatusEnum("analysis_status").notNull().default("pending"),
    exerciseStatus: stageStatusEnum("exercise_status").notNull().default("pending"),
    analysisPromptVersion: text("analysis_prompt_version"),
    exercisePromptVersion: text("exercise_prompt_version"),
    gradingPromptVersion: text("grading_prompt_version"),
    analysisModel: text("analysis_model"),
    exerciseModel: text("exercise_model"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    sourceVersionUnique: uniqueIndex("lessons_source_version_unique").on(table.sourceTextId, table.version),
    userIdx: index("lessons_user_idx").on(table.userId),
  }),
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
    normalizedPhrase: text("normalized_phrase").notNull(),
    senseKey: text("sense_key").notNull(),
    meaningVi: text("meaning_vi").notNull(),
    meaningInContextVi: text("meaning_in_context_vi").notNull(),
    literalTranslationVi: text("literal_translation_vi"),
    naturalTranslationVi: text("natural_translation_vi"),
    whyConfusingVi: text("why_confusing_vi"),
    category: phraseCategoryEnum("category").notNull(),
    difficulty: levelEnum("difficulty").notNull(),
    isSensitive: boolean("is_sensitive").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    lessonIdx: index("key_phrases_lesson_idx").on(table.lessonId),
  }),
);

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    keyPhraseId: uuid("key_phrase_id").references(() => keyPhrases.id, { onDelete: "set null" }),
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
  }),
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
  }),
);

export const userErrors = pgTable(
  "user_errors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id").references(() => attempts.id, { onDelete: "set null" }),
    lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    keyPhraseId: uuid("key_phrase_id").references(() => keyPhrases.id, { onDelete: "set null" }),
    errorType: errorTypeEnum("error_type").notNull(),
    normalizedPhrase: text("normalized_phrase").notNull(),
    senseKey: text("sense_key").notNull(),
    explanationVi: text("explanation_vi").notNull(),
    isSourceSensitive: boolean("is_source_sensitive").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("user_errors_user_idx").on(table.userId),
  }),
);

export const mistakePatterns = pgTable(
  "mistake_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    normalizedPhrase: text("normalized_phrase").notNull(),
    senseKey: text("sense_key").notNull(),
    category: phraseCategoryEnum("category").notNull(),
    errorType: errorTypeEnum("error_type").notNull(),
    meaningVi: text("meaning_vi").notNull(),
    safeReviewPromptVi: text("safe_review_prompt_vi").notNull(),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    intervalDays: integer("interval_days").notNull().default(0),
    dueAt: timestamp("due_at", { mode: "date" }).notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { mode: "date" }),
    isSensitive: boolean("is_sensitive").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    aggregateUnique: uniqueIndex("mistake_patterns_aggregate_unique").on(
      table.userId,
      table.normalizedPhrase,
      table.senseKey,
      table.errorType,
    ),
    dueIdx: index("mistake_patterns_due_idx").on(table.userId, table.dueAt),
  }),
);

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceTextId: uuid("source_text_id")
      .notNull()
      .references(() => sourceTexts.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    status: jobStatusEnum("status").notNull().default("queued"),
    stage: text("stage").notNull().default("analysis"),
    attempts: integer("attempts").notNull().default(0),
    errorMessage: text("error_message"),
    lockedAt: timestamp("locked_at", { mode: "date" }),
    lockedBy: text("locked_by"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userStatusIdx: index("generation_jobs_user_status_idx").on(table.userId, table.status),
    statusIdx: index("generation_jobs_status_idx").on(table.status, table.createdAt),
  }),
);

export const generationMilestones = pgTable(
  "generation_milestones",
  {
    id: serial("id").primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    generationJobId: uuid("generation_job_id")
      .notNull()
      .references(() => generationJobs.id, { onDelete: "cascade" }),
    code: generationMilestoneCodeEnum("code").notNull(),
    stage: text("stage"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    lessonJobIdx: index("generation_milestones_lesson_job_idx").on(table.lessonId, table.generationJobId, table.id),
    jobCodeStageUnique: uniqueIndex("generation_milestones_job_code_stage_unique").on(
      table.generationJobId,
      table.code,
      table.stage,
    ),
  }),
);

export const generationThoughts = pgTable(
  "generation_thoughts",
  {
    id: serial("id").primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    generationJobId: uuid("generation_job_id")
      .notNull()
      .references(() => generationJobs.id, { onDelete: "cascade" }),
    stage: text("stage"),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    lessonJobIdx: index("generation_thoughts_lesson_job_idx").on(table.lessonId, table.generationJobId, table.id),
  }),
);

export const aiRequests = pgTable(
  "ai_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    purpose: aiPurposeEnum("purpose").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    schemaVersion: text("schema_version").notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: text("status").notNull(),
    latencyMs: integer("latency_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costMicros: integer("cost_micros"),
    errorClass: text("error_class"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("ai_requests_user_idx").on(table.userId),
    lessonIdx: index("ai_requests_lesson_idx").on(table.lessonId),
  }),
);

export type SourceText = typeof sourceTexts.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type KeyPhrase = typeof keyPhrases.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type MistakePattern = typeof mistakePatterns.$inferSelect;
export type GenerationJob = typeof generationJobs.$inferSelect;
export type GenerationMilestone = typeof generationMilestones.$inferSelect;
export type GenerationThought = typeof generationThoughts.$inferSelect;
