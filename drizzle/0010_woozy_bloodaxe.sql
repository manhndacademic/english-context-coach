-- Backfill examples from example_en and example_vi if examples is empty/default
UPDATE key_phrases
SET examples = jsonb_build_array(
  jsonb_build_object('exampleEn', example_en, 'exampleVi', example_vi)
)
WHERE (examples IS NULL OR examples = '[]'::jsonb)
  AND example_en IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "key_phrases" DROP COLUMN "example_en";--> statement-breakpoint
ALTER TABLE "key_phrases" DROP COLUMN "example_vi";