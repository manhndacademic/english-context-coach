CREATE TYPE "public"."generation_milestone_code" AS ENUM('queued', 'claimed', 'analysis_started', 'analysis_saved', 'exercises_started', 'exercises_saved', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "generation_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" uuid NOT NULL,
	"generation_job_id" uuid NOT NULL,
	"code" "generation_milestone_code" NOT NULL,
	"stage" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_milestones" ADD CONSTRAINT "generation_milestones_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_milestones" ADD CONSTRAINT "generation_milestones_generation_job_id_generation_jobs_id_fk" FOREIGN KEY ("generation_job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_milestones_lesson_job_idx" ON "generation_milestones" USING btree ("lesson_id","generation_job_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_milestones_job_code_stage_unique" ON "generation_milestones" USING btree ("generation_job_id","code","stage");