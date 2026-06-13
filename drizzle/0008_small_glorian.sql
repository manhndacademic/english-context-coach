CREATE TYPE "public"."mastery_state" AS ENUM('active', 'mastered');--> statement-breakpoint
DROP INDEX "mistake_patterns_due_idx";--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "mastery_state" "mastery_state" DEFAULT 'active' NOT NULL;--> statement-breakpoint
UPDATE "mistake_patterns" SET "mastery_state" = 'mastered' WHERE "interval_days" >= 14;--> statement-breakpoint
CREATE INDEX "mistake_patterns_due_idx" ON "mistake_patterns" USING btree ("user_id","mastery_state","due_at");
