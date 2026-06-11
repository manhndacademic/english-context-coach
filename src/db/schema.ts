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
]);

export const reviewExerciseTypeEnum = pgEnum("review_exercise_type", [
  "meaning_choice",
  "cloze_phrase",
  "natural_interpretation",
  "context_explanation",
  "tone_structure_purpose",
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
export const gradingStatusEnum = pgEnum("grading_status", ["pending", "succeeded", "failed"]);
export const reviewResultEnum = pgEnum("review_result", [
  "correct",
  "partially_correct",
  "incorrect",
  "grading_failed",
]);
export const masteryStateEnum = pgEnum("mastery_state", [
  "new",
  "learning",
  "reviewing",
  "mastered",
  "relearning",
]);
export const generationMilestoneCodeEnum = pgEnum("generation_milestone_code", [
  "queued",
  "claimed",
  "analysis_started",
  "text_type_started",
  "confusing_phrases_started",
  "context_analysis_started",
  "saving_analysis",
  "analysis_saved",
  "exercises_started",
  "validating_lesson",
  "exercises_saved",
  "retrying",
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
    category: lessonFocusCategoryEnum("category").notNull(),
    explanationVi: text("explanation_vi").notNull(),
    difficulty: levelEnum("difficulty").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    lessonIdx: index("lesson_focuses_lesson_idx").on(table.lessonId),
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
    lessonFocusId: uuid("lesson_focus_id").references(() => lessonFocuses.id, { onDelete: "set null" }),
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
    score: integer("score"),
    isCorrect: boolean("is_correct"),
    feedbackVi: text("feedback_vi").notNull(),
    gradingStatus: gradingStatusEnum("grading_status").notNull().default("succeeded"),
    idempotencyKey: text("idempotency_key"),
    gradingMetadata: jsonb("grading_metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    exerciseIdx: index("attempts_exercise_idx").on(table.exerciseId),
    userIdx: index("attempts_user_idx").on(table.userId),
    idempotencyUnique: uniqueIndex("attempts_idempotency_unique").on(table.userId, table.idempotencyKey),
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
    lessonFocusId: uuid("lesson_focus_id").references(() => lessonFocuses.id, { onDelete: "set null" }),
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

export const mistakeConcepts = pgTable(
  "mistake_concepts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conceptKey: text("concept_key").notNull(),
    category: text("category").notNull(),
    errorType: errorTypeEnum("error_type").notNull(),
    titleVi: text("title_vi").notNull(),
    explanationVi: text("explanation_vi").notNull(),
    safeReviewSeed: jsonb("safe_review_seed").$type<Record<string, unknown>>().notNull(),
    masteryState: masteryStateEnum("mastery_state").notNull().default("new"),
    intervalDays: integer("interval_days").notNull().default(0),
    dueAt: timestamp("due_at", { mode: "date" }).notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    conceptUnique: uniqueIndex("mistake_concepts_user_key_unique").on(table.userId, table.conceptKey),
    dueIdx: index("mistake_concepts_due_idx").on(table.userId, table.dueAt),
  }),
);

export const mistakePatterns = pgTable(
  "mistake_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mistakeConceptId: uuid("mistake_concept_id").references(() => mistakeConcepts.id, { onDelete: "cascade" }),
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

export const mistakeEvidence = pgTable(
  "mistake_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mistakeConceptId: uuid("mistake_concept_id")
      .notNull()
      .references(() => mistakeConcepts.id, { onDelete: "cascade" }),
    mistakePatternId: uuid("mistake_pattern_id")
      .notNull()
      .references(() => mistakePatterns.id, { onDelete: "cascade" }),
    userErrorId: uuid("user_error_id")
      .notNull()
      .references(() => userErrors.id, { onDelete: "cascade" }),
    sourceTextId: uuid("source_text_id")
      .notNull()
      .references(() => sourceTexts.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("mistake_evidence_user_idx").on(table.userId),
    sourceIdx: index("mistake_evidence_source_idx").on(table.userId, table.sourceTextId),
    conceptIdx: index("mistake_evidence_concept_idx").on(table.mistakeConceptId),
    userErrorUnique: uniqueIndex("mistake_evidence_user_error_unique").on(table.userErrorId),
  }),
);

export const reviewAttempts = pgTable(
  "review_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mistakeConceptId: uuid("mistake_concept_id")
      .notNull()
      .references(() => mistakeConcepts.id, { onDelete: "cascade" }),
    mistakePatternId: uuid("mistake_pattern_id").references(() => mistakePatterns.id, { onDelete: "set null" }),
    reviewExerciseType: reviewExerciseTypeEnum("review_exercise_type").notNull(),
    promptSnapshot: jsonb("prompt_snapshot").$type<Record<string, unknown>>().notNull(),
    answer: text("answer").notNull(),
    score: integer("score"),
    result: reviewResultEnum("result").notNull(),
    feedbackVi: text("feedback_vi").notNull(),
    gradingStatus: gradingStatusEnum("grading_status").notNull(),
    previousMasteryState: masteryStateEnum("previous_mastery_state").notNull(),
    nextMasteryState: masteryStateEnum("next_mastery_state").notNull(),
    previousIntervalDays: integer("previous_interval_days").notNull(),
    nextIntervalDays: integer("next_interval_days").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    conceptIdx: index("review_attempts_concept_idx").on(table.mistakeConceptId, table.createdAt),
    idempotencyUnique: uniqueIndex("review_attempts_idempotency_unique").on(table.userId, table.idempotencyKey),
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
export type LessonFocus = typeof lessonFocuses.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type UserError = typeof userErrors.$inferSelect;
export type MistakeConcept = typeof mistakeConcepts.$inferSelect;
export type MistakePattern = typeof mistakePatterns.$inferSelect;
export type MistakeEvidence = typeof mistakeEvidence.$inferSelect;
export type ReviewAttempt = typeof reviewAttempts.$inferSelect;
export type GenerationJob = typeof generationJobs.$inferSelect;
export type GenerationMilestone = typeof generationMilestones.$inferSelect;
