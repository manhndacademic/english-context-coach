ALTER TABLE "lessons" ADD COLUMN "input_mode" text DEFAULT 'understand_and_practice' NOT NULL;--> statement-breakpoint
ALTER TABLE "sentence_breakdowns" ADD COLUMN "corrected_sentence_en" text;