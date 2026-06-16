CREATE TYPE "public"."review_source" AS ENUM('mistake', 'phrase', 'manual');--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "source" "review_source" DEFAULT 'mistake' NOT NULL;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "key_phrase_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_digest_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_digest_hour" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD CONSTRAINT "mistake_patterns_key_phrase_id_key_phrases_id_fk" FOREIGN KEY ("key_phrase_id") REFERENCES "public"."key_phrases"("id") ON DELETE set null ON UPDATE no action;