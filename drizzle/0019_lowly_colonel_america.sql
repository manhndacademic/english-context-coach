DROP INDEX "phrase_practices_aggregate_unique";--> statement-breakpoint
ALTER TABLE "mistake_patterns" ALTER COLUMN "sense_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "phrase_practices_aggregate_unique" ON "phrase_practices" USING btree ("user_id","concept_key","sense_key");