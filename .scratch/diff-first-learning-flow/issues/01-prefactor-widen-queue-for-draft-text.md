Status: ready-for-agent

## Parent

[Diff-first Learning Flow PRD](.scratch/diff-first-learning-flow/PRD.md)

## What to build

Widen `LessonGenerationEngine.queue()` to accept an optional `draftContent` parameter alongside the existing `content` (which becomes the SourceText). Add `draft_texts` and `correction_items` database tables. When `draftContent` is provided, persist it as a DraftText record linked to the SourceText. The generation pipeline does not yet use the DraftText — this slice only lays the schema and port foundation.

The `draft_texts` table needs: `id` (UUID), `userId`, `sourceTextId` (FK to source_texts), `content` (text), `createdAt`.

The `correction_items` table needs: `id` (UUID), `lessonId` (FK to lessons), `draftPhrase`, `correctedPhrase`, `explanationVi`, `literalTrapVi`, `exampleEn`, `exampleVi`, `category`, `errorType`, `orderIndex`, `createdAt`.

Update the `LessonTransactionRepository.createSourceTextAndLessonAndJob()` port to accept optional draft content and persist the DraftText in the same transaction.

## Acceptance criteria

- [ ] `draft_texts` and `correction_items` tables exist in the schema with correct columns and foreign keys
- [ ] Migration generated via `bun run db:generate`
- [ ] `LessonGenerationEngine.queue()` accepts optional `draftContent` parameter
- [ ] When `draftContent` is provided, a DraftText record is created and linked to the SourceText
- [ ] When `draftContent` is omitted, behavior is identical to current (no regression)
- [ ] `LessonAggregate` port includes optional `draftText` field
- [ ] Unit tests verify queue() with and without draftContent
- [ ] `bun run lint && bun run typecheck && bun run test && bun run build` all pass

## Blocked by

None - can start immediately
