ALTER TABLE "mistake_patterns" ADD COLUMN "ease_factor" real DEFAULT 2.5 NOT NULL;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD COLUMN "repetitions" integer DEFAULT 0 NOT NULL;