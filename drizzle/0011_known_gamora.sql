CREATE INDEX "attempts_lesson_idx" ON "attempts" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "user_errors_lesson_idx" ON "user_errors" USING btree ("lesson_id");