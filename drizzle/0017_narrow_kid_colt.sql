CREATE TABLE "phrase_practices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "review_source" DEFAULT 'phrase' NOT NULL,
	"key_phrase_id" uuid,
	"concept_key" text NOT NULL,
	"normalized_phrase" text NOT NULL,
	"sense_key" text,
	"category" "phrase_category" NOT NULL,
	"meaning_vi" text NOT NULL,
	"safe_review_prompt_vi" text NOT NULL,
	"review_prompt_en" text,
	"review_prompt_vi" text,
	"review_rubric_vi" text,
	"review_correct_answer" text,
	"review_acceptable_answers" jsonb,
	"review_type" text DEFAULT 'natural_translation' NOT NULL,
	"review_choices" jsonb,
	"review_prompt_status" "job_status" DEFAULT 'succeeded' NOT NULL,
	"review_prompt_attempts" integer DEFAULT 0 NOT NULL,
	"review_prompt_error" text,
	"review_prompt_locked_at" timestamp,
	"review_prompt_locked_by" text,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"ease_factor" real DEFAULT 2.5 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"mastery_state" "mastery_state" DEFAULT 'active' NOT NULL,
	"due_at" timestamp DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "phrase_practices" ADD CONSTRAINT "phrase_practices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phrase_practices" ADD CONSTRAINT "phrase_practices_key_phrase_id_key_phrases_id_fk" FOREIGN KEY ("key_phrase_id") REFERENCES "public"."key_phrases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "phrase_practices_aggregate_unique" ON "phrase_practices" USING btree ("user_id","concept_key");--> statement-breakpoint
CREATE INDEX "phrase_practices_due_idx" ON "phrase_practices" USING btree ("user_id","mastery_state","due_at");