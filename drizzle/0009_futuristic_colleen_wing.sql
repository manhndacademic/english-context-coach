ALTER TYPE "public"."exercise_type" ADD VALUE 'trap_choice';--> statement-breakpoint
ALTER TYPE "public"."exercise_type" ADD VALUE 'phrase_production';--> statement-breakpoint
ALTER TYPE "public"."exercise_type" ADD VALUE 'dialogue_completion';--> statement-breakpoint
ALTER TYPE "public"."exercise_type" ADD VALUE 'register_shift';--> statement-breakpoint
ALTER TYPE "public"."exercise_type" ADD VALUE 'trap_detect';--> statement-breakpoint
ALTER TABLE "key_phrases" ADD COLUMN "examples" jsonb DEFAULT '[]'::jsonb NOT NULL;