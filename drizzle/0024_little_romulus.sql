CREATE TABLE "correction_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"draft_phrase" text NOT NULL,
	"corrected_phrase" text NOT NULL,
	"explanation_vi" text NOT NULL,
	"literal_trap_vi" text,
	"example_en" text NOT NULL,
	"example_vi" text NOT NULL,
	"category" "phrase_category" NOT NULL,
	"error_type" "error_type" NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_texts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_text_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "correction_item_id" uuid;--> statement-breakpoint
ALTER TABLE "user_errors" ADD COLUMN "correction_item_id" uuid;--> statement-breakpoint
ALTER TABLE "correction_items" ADD CONSTRAINT "correction_items_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_texts" ADD CONSTRAINT "draft_texts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_texts" ADD CONSTRAINT "draft_texts_source_text_id_source_texts_id_fk" FOREIGN KEY ("source_text_id") REFERENCES "public"."source_texts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "correction_items_lesson_idx" ON "correction_items" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "draft_texts_user_idx" ON "draft_texts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "draft_texts_source_text_idx" ON "draft_texts" USING btree ("source_text_id");--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_correction_item_id_correction_items_id_fk" FOREIGN KEY ("correction_item_id") REFERENCES "public"."correction_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_errors" ADD CONSTRAINT "user_errors_correction_item_id_correction_items_id_fk" FOREIGN KEY ("correction_item_id") REFERENCES "public"."correction_items"("id") ON DELETE set null ON UPDATE no action;