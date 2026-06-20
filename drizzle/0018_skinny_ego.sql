CREATE TABLE "phrase_practice_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phrase_practice_id" uuid NOT NULL,
	"answer" text NOT NULL,
	"score" integer NOT NULL,
	"is_correct" boolean NOT NULL,
	"feedback_vi" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "phrase_practice_attempts" ADD CONSTRAINT "phrase_practice_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phrase_practice_attempts" ADD CONSTRAINT "phrase_practice_attempts_phrase_practice_id_phrase_practices_id_fk" FOREIGN KEY ("phrase_practice_id") REFERENCES "public"."phrase_practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phrase_practice_attempts_user_idx" ON "phrase_practice_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "phrase_practice_attempts_practice_idx" ON "phrase_practice_attempts" USING btree ("phrase_practice_id");