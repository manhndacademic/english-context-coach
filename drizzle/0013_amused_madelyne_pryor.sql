ALTER TABLE "mistake_patterns" ADD COLUMN "review_type" text DEFAULT 'natural_translation' NOT NULL;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "review_choices" jsonb;