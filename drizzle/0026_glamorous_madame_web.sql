CREATE TYPE "public"."formality" AS ENUM('formal', 'semi_formal', 'casual');--> statement-breakpoint
ALTER TYPE "public"."text_type" ADD VALUE 'chat_message';--> statement-breakpoint
ALTER TYPE "public"."text_type" ADD VALUE 'ticket';--> statement-breakpoint
ALTER TYPE "public"."text_type" ADD VALUE 'code_review';--> statement-breakpoint
ALTER TYPE "public"."text_type" ADD VALUE 'meeting_notes';--> statement-breakpoint
DROP INDEX "user_ai_api_keys_user_status_idx";--> statement-breakpoint
DROP INDEX "user_ai_api_keys_user_fingerprint_unique";--> statement-breakpoint
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_provider_provider_account_id_pk";--> statement-breakpoint
ALTER TABLE "correction_items" ADD COLUMN "cultural_note_vi" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "formality" "formality";--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "suggested_text" text;