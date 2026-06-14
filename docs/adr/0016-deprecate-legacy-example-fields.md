# Deprecate Legacy Example Fields in `key_phrases` Table

To simplify the database schema, reduce duplication, and optimize AI token usage, we decided to deprecate the legacy `exampleEn` and `exampleVi` root columns in the `key_phrases` table in favor of the newer `examples` JSONB array column.

## Context and Problem

Historically, each key phrase in the `key_phrases` table only supported a single example sentence through the `exampleEn` (text) and `exampleVi` (text) columns. In a subsequent migration, the schema was extended with the `examples` (jsonb) column to support up to 3 context-relevant example sentences.

Currently, the system is in a transitional state:

1. **AI Output & Prompt**: The `analysis-prompt.ts` and Zod validation `keyPhraseSchema` still require `exampleEn` and `exampleVi` alongside `examples`, duplicating the first item of `examples` into the root fields.
2. **Frontend UI**: `key-phrase-list.tsx` reads from `examples` if present, but falls back to `exampleEn` and `exampleVi` if `examples` is empty.
3. **Database Schema**: The legacy columns remain in the database schema.

This duplication creates schema clutter, increases prompt token usage, and complicates validation rules.

## Decisions

We will execute the following deprecation and migration plan:

1. **Phase 1: Data Backfill (Migration)**:
   Write a migration script (SQL or TS script) to backfill any existing records where `examples` is empty or defaults to `[]` but `exampleEn`/`exampleVi` are populated:

   ```sql
   UPDATE key_phrases
   SET examples = jsonb_build_array(
     jsonb_build_object('exampleEn', example_en, 'exampleVi', example_vi)
   )
   WHERE (examples IS NULL OR examples = '[]'::jsonb)
     AND example_en IS NOT NULL;
   ```

2. **Phase 2: Remove UI Fallbacks**:
   Clean up the frontend renderer in `src/components/key-phrase-list.tsx` to display examples exclusively from the `examples` array, eliminating the root field check:

   ```tsx
   // Before
   {phrase.examples && phrase.examples.length > 0 ? ( ... ) : phrase.exampleEn || phrase.exampleVi ? ( ... ) : null}

   // After
   {phrase.examples && phrase.examples.length > 0 && ( ... )}
   ```

3. **Phase 3: Clean up Schema & Prompts**:
   - Update `src/lib/ai/schemas.ts` and `src/lib/ai/prompts/analysis-prompt.ts` to remove the root `exampleEn` and `exampleVi` fields entirely.
   - Run `bun run db:migrate` / `bun run db:push` to generate a migration dropping `example_en` and `example_vi` columns from the `key_phrases` table.

## Considered Options

- **Retain fields indefinitely**: Rejected because it increases prompt tokens and duplicates data across columns.
- **Drop columns without backfill**: Rejected because it would cause data loss for historical lessons created before the `examples` column was introduced.
