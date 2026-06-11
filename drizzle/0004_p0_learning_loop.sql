CREATE TYPE "public"."review_exercise_type" AS ENUM('meaning_choice', 'cloze_phrase', 'natural_interpretation', 'context_explanation', 'tone_structure_purpose');--> statement-breakpoint
CREATE TYPE "public"."grading_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_result" AS ENUM('correct', 'partially_correct', 'incorrect', 'grading_failed');--> statement-breakpoint
CREATE TYPE "public"."mastery_state" AS ENUM('new', 'learning', 'reviewing', 'mastered', 'relearning');--> statement-breakpoint
ALTER TYPE "public"."generation_milestone_code" ADD VALUE 'text_type_started';--> statement-breakpoint
ALTER TYPE "public"."generation_milestone_code" ADD VALUE 'confusing_phrases_started';--> statement-breakpoint
ALTER TYPE "public"."generation_milestone_code" ADD VALUE 'context_analysis_started';--> statement-breakpoint
ALTER TYPE "public"."generation_milestone_code" ADD VALUE 'saving_analysis';--> statement-breakpoint
ALTER TYPE "public"."generation_milestone_code" ADD VALUE 'validating_lesson';--> statement-breakpoint
ALTER TYPE "public"."generation_milestone_code" ADD VALUE 'retrying';--> statement-breakpoint
ALTER TABLE "attempts" ALTER COLUMN "score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ALTER COLUMN "is_correct" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "grading_status" "grading_status" DEFAULT 'succeeded' NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_idempotency_unique" ON "attempts" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE TABLE "mistake_concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"concept_key" text NOT NULL,
	"category" text NOT NULL,
	"error_type" "error_type" NOT NULL,
	"title_vi" text NOT NULL,
	"explanation_vi" text NOT NULL,
	"safe_review_seed" jsonb NOT NULL,
	"mastery_state" "mastery_state" DEFAULT 'new' NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mistake_concepts" ADD CONSTRAINT "mistake_concepts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mistake_concepts_user_key_unique" ON "mistake_concepts" USING btree ("user_id","concept_key");--> statement-breakpoint
CREATE INDEX "mistake_concepts_due_idx" ON "mistake_concepts" USING btree ("user_id","due_at");--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "mistake_concept_id" uuid;--> statement-breakpoint
INSERT INTO "mistake_concepts" (
	"user_id",
	"concept_key",
	"category",
	"error_type",
	"title_vi",
	"explanation_vi",
	"safe_review_seed",
	"mastery_state",
	"interval_days",
	"due_at",
	"last_reviewed_at",
	"created_at",
	"updated_at"
)
SELECT
	"user_id",
	'legacy:' || "error_type"::text || ':' || "sense_key",
	"category"::text,
	"error_type",
	'Ôn lại: ' || "normalized_phrase",
	"meaning_vi",
	jsonb_build_object(
		'kind', 'legacy_pattern',
		'phrase', "normalized_phrase",
		'meaningVi', "meaning_vi",
		'promptVi', "safe_review_prompt_vi"
	),
	CASE WHEN "interval_days" >= 14 THEN 'mastered'::"mastery_state" WHEN "interval_days" > 0 THEN 'reviewing'::"mastery_state" ELSE 'learning'::"mastery_state" END,
	"interval_days",
	"due_at",
	"last_reviewed_at",
	"created_at",
	"updated_at"
FROM "mistake_patterns"
ON CONFLICT ("user_id","concept_key") DO NOTHING;
--> statement-breakpoint
UPDATE "mistake_patterns"
SET "mistake_concept_id" = "mistake_concepts"."id"
FROM "mistake_concepts"
WHERE "mistake_concepts"."user_id" = "mistake_patterns"."user_id"
	AND "mistake_concepts"."concept_key" = 'legacy:' || "mistake_patterns"."error_type"::text || ':' || "mistake_patterns"."sense_key";--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD CONSTRAINT "mistake_patterns_mistake_concept_id_mistake_concepts_id_fk" FOREIGN KEY ("mistake_concept_id") REFERENCES "public"."mistake_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "mistake_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mistake_concept_id" uuid NOT NULL,
	"mistake_pattern_id" uuid NOT NULL,
	"user_error_id" uuid NOT NULL,
	"source_text_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mistake_evidence" ADD CONSTRAINT "mistake_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_evidence" ADD CONSTRAINT "mistake_evidence_mistake_concept_id_mistake_concepts_id_fk" FOREIGN KEY ("mistake_concept_id") REFERENCES "public"."mistake_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_evidence" ADD CONSTRAINT "mistake_evidence_mistake_pattern_id_mistake_patterns_id_fk" FOREIGN KEY ("mistake_pattern_id") REFERENCES "public"."mistake_patterns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_evidence" ADD CONSTRAINT "mistake_evidence_user_error_id_user_errors_id_fk" FOREIGN KEY ("user_error_id") REFERENCES "public"."user_errors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_evidence" ADD CONSTRAINT "mistake_evidence_source_text_id_source_texts_id_fk" FOREIGN KEY ("source_text_id") REFERENCES "public"."source_texts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_evidence" ADD CONSTRAINT "mistake_evidence_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mistake_evidence_user_idx" ON "mistake_evidence" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mistake_evidence_source_idx" ON "mistake_evidence" USING btree ("user_id","source_text_id");--> statement-breakpoint
CREATE INDEX "mistake_evidence_concept_idx" ON "mistake_evidence" USING btree ("mistake_concept_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mistake_evidence_user_error_unique" ON "mistake_evidence" USING btree ("user_error_id");--> statement-breakpoint
INSERT INTO "mistake_evidence" (
	"user_id",
	"mistake_concept_id",
	"mistake_pattern_id",
	"user_error_id",
	"source_text_id",
	"lesson_id",
	"created_at"
)
SELECT
	"user_errors"."user_id",
	"mistake_patterns"."mistake_concept_id",
	"mistake_patterns"."id",
	"user_errors"."id",
	"lessons"."source_text_id",
	"user_errors"."lesson_id",
	"user_errors"."created_at"
FROM "user_errors"
JOIN "lessons" ON "lessons"."id" = "user_errors"."lesson_id"
JOIN "mistake_patterns" ON "mistake_patterns"."user_id" = "user_errors"."user_id"
	AND "mistake_patterns"."normalized_phrase" = "user_errors"."normalized_phrase"
	AND "mistake_patterns"."sense_key" = "user_errors"."sense_key"
	AND "mistake_patterns"."error_type" = "user_errors"."error_type"
WHERE "user_errors"."lesson_id" IS NOT NULL
	AND "mistake_patterns"."mistake_concept_id" IS NOT NULL
ON CONFLICT ("user_error_id") DO NOTHING;
--> statement-breakpoint
CREATE TABLE "review_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mistake_concept_id" uuid NOT NULL,
	"mistake_pattern_id" uuid,
	"review_exercise_type" "review_exercise_type" NOT NULL,
	"prompt_snapshot" jsonb NOT NULL,
	"answer" text NOT NULL,
	"score" integer,
	"result" "review_result" NOT NULL,
	"feedback_vi" text NOT NULL,
	"grading_status" "grading_status" NOT NULL,
	"previous_mastery_state" "mastery_state" NOT NULL,
	"next_mastery_state" "mastery_state" NOT NULL,
	"previous_interval_days" integer NOT NULL,
	"next_interval_days" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_attempts" ADD CONSTRAINT "review_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_attempts" ADD CONSTRAINT "review_attempts_mistake_concept_id_mistake_concepts_id_fk" FOREIGN KEY ("mistake_concept_id") REFERENCES "public"."mistake_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_attempts" ADD CONSTRAINT "review_attempts_mistake_pattern_id_mistake_patterns_id_fk" FOREIGN KEY ("mistake_pattern_id") REFERENCES "public"."mistake_patterns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_attempts_concept_idx" ON "review_attempts" USING btree ("mistake_concept_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_attempts_idempotency_unique" ON "review_attempts" USING btree ("user_id","idempotency_key");--> statement-breakpoint
DROP TABLE "generation_thoughts";--> statement-breakpoint
