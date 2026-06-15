CREATE TYPE "public"."user_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "ai_requests" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "sentence_breakdowns" ADD COLUMN "diff_spans" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'pending' NOT NULL;