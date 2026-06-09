CREATE TABLE "generation_thoughts" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" uuid NOT NULL,
	"generation_job_id" uuid NOT NULL,
	"stage" text,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_thoughts" ADD CONSTRAINT "generation_thoughts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_thoughts" ADD CONSTRAINT "generation_thoughts_generation_job_id_generation_jobs_id_fk" FOREIGN KEY ("generation_job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_thoughts_lesson_job_idx" ON "generation_thoughts" USING btree ("lesson_id","generation_job_id","id");