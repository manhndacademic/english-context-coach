Status: ready-for-agent

## Parent

[.scratch/action-layer-cleanup/PRD.md](../PRD.md)

## What to build

Move the `getMistakePatternLessonsMap` function from `app/actions/review.ts` into `MistakePatternRepository` as a new method `getLessonsForPatterns(userId: string)`.

The new method must return the same shape as the current function: `Record<string, Array<{ id: string; title: string | null }>>`. The join logic and in-memory grouping loop move verbatim from the action file into the Drizzle adapter.

Update `app/actions/review.ts` to call `mistakePatternRepository.getLessonsForPatterns(userId)` instead of running the inline query. The action becomes a one-liner delegate for this operation.

Add or extend the adapter test for `MistakePatternRepository` (in `drizzle-repositories.test.ts`) to cover the grouping logic.

> **Note**: This issue should be executed **after** domain-seam-restoration is merged, because PRD 1 also adds methods to `MistakePatternRepository`. Merging in order prevents conflicts.

## Acceptance criteria

- [ ] `MistakePatternRepository` port declares `getLessonsForPatterns(userId: string): Promise<Record<string, Array<{ id: string; title: string | null }>>>`
- [ ] `DrizzleMistakePatternRepository` implements `getLessonsForPatterns` with the existing join + grouping logic
- [ ] `app/actions/review.ts` contains no raw Drizzle join for lesson/pattern mapping; delegates to the repository method
- [ ] The UI component consuming this data receives the same shape as before — no UI changes required
- [ ] Adapter test covers the grouping logic (multiple patterns → multiple lessons per group)
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes

## Blocked by

None — can start immediately (but should be merged after domain-seam-restoration to avoid conflicts on `MistakePatternRepository`)
