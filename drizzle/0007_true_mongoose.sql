CREATE TABLE "ai_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text DEFAULT 'gemini' NOT NULL,
	"encrypted_key" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"error_message" text,
	"rate_limited_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "review_prompt_status" "job_status" DEFAULT 'succeeded' NOT NULL;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "review_prompt_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "review_prompt_error" text;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "review_prompt_locked_at" timestamp;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "review_prompt_locked_by" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "custom_gemini_api_key" text;--> statement-breakpoint
CREATE INDEX "ai_api_keys_status_idx" ON "ai_api_keys" USING btree ("status");