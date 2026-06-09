CREATE TYPE "public"."lesson_focus_category" AS ENUM('tone', 'structure', 'purpose', 'context');--> statement-breakpoint
ALTER TYPE "public"."exercise_type" ADD VALUE 'focus_question';--> statement-breakpoint
CREATE TABLE "lesson_focuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" "lesson_focus_category" NOT NULL,
	"explanation_vi" text NOT NULL,
	"difficulty" "detected_level" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "lesson_focus_id" uuid;--> statement-breakpoint
ALTER TABLE "user_errors" ADD COLUMN "lesson_focus_id" uuid;--> statement-breakpoint
ALTER TABLE "lesson_focuses" ADD CONSTRAINT "lesson_focuses_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_focuses" ADD CONSTRAINT "lesson_focuses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_focuses_lesson_idx" ON "lesson_focuses" USING btree ("lesson_id");--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_lesson_focus_id_lesson_focuses_id_fk" FOREIGN KEY ("lesson_focus_id") REFERENCES "public"."lesson_focuses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_errors" ADD CONSTRAINT "user_errors_lesson_focus_id_lesson_focuses_id_fk" FOREIGN KEY ("lesson_focus_id") REFERENCES "public"."lesson_focuses"("id") ON DELETE set null ON UPDATE no action;