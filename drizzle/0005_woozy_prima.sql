CREATE TABLE "review_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mistake_pattern_id" uuid NOT NULL,
	"answer" text NOT NULL,
	"score" integer NOT NULL,
	"is_correct" boolean NOT NULL,
	"feedback_vi" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "mistake_patterns_aggregate_unique";--> statement-breakpoint
ALTER TABLE "mistake_patterns" ALTER COLUMN "sense_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "key_phrases" ADD COLUMN "concept_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "key_phrases" ADD COLUMN "concept_phrase" text NOT NULL;--> statement-breakpoint
ALTER TABLE "key_phrases" ADD COLUMN "concept_meaning_vi" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_focuses" ADD COLUMN "concept_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_focuses" ADD COLUMN "concept_phrase" text NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_focuses" ADD COLUMN "concept_meaning_vi" text NOT NULL;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "concept_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "review_prompt_en" text;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "review_prompt_vi" text;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "review_rubric_vi" text;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "review_correct_answer" text;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "review_acceptable_answers" jsonb;--> statement-breakpoint
ALTER TABLE "user_errors" ADD COLUMN "concept_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_errors" ADD COLUMN "is_repeated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "review_attempts" ADD CONSTRAINT "review_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_attempts" ADD CONSTRAINT "review_attempts_mistake_pattern_id_mistake_patterns_id_fk" FOREIGN KEY ("mistake_pattern_id") REFERENCES "public"."mistake_patterns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_attempts_user_idx" ON "review_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "review_attempts_pattern_idx" ON "review_attempts" USING btree ("mistake_pattern_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mistake_patterns_aggregate_unique" ON "mistake_patterns" USING btree ("user_id","concept_key","error_type");