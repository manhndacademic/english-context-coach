ALTER TABLE "mistake_patterns" ALTER COLUMN "sense_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "phrase_practices" ALTER COLUMN "sense_key" SET NOT NULL;