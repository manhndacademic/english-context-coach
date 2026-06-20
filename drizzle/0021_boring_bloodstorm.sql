ALTER TABLE "mistake_patterns" DROP CONSTRAINT "mistake_patterns_key_phrase_id_key_phrases_id_fk";
--> statement-breakpoint
ALTER TABLE "mistake_patterns" DROP COLUMN "source";--> statement-breakpoint
ALTER TABLE "mistake_patterns" DROP COLUMN "key_phrase_id";--> statement-breakpoint
ALTER TABLE "phrase_practices" DROP COLUMN "source";--> statement-breakpoint
DROP TYPE "public"."review_source";