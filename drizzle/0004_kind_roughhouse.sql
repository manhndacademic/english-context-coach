CREATE TABLE "sentence_breakdowns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sentence" text NOT NULL,
	"natural_meaning_vi" text NOT NULL,
	"structure_notes_vi" text NOT NULL,
	"tone_or_context_vi" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "key_phrases" ADD COLUMN "example_en" text;--> statement-breakpoint
ALTER TABLE "key_phrases" ADD COLUMN "example_vi" text;--> statement-breakpoint
ALTER TABLE "sentence_breakdowns" ADD CONSTRAINT "sentence_breakdowns_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentence_breakdowns" ADD CONSTRAINT "sentence_breakdowns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sentence_breakdowns_lesson_idx" ON "sentence_breakdowns" USING btree ("lesson_id","order_index");