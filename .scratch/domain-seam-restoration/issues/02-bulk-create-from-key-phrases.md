Status: ready-for-agent

## Parent

[.scratch/domain-seam-restoration/PRD.md](../PRD.md)

## What to build

Add a new method `bulkCreateFromKeyPhrases(userId, phrases)` to the `MistakePatternRepository` port in `memory/ports.ts`. Implement it in `DrizzleMistakePatternRepository` using `onConflictDoNothing` on the `(userId, conceptKey, errorType)` composite key.

The method must apply the same deduplication rule as the current `addPhrasesToReviewQueue` utility: if a `(userId, conceptKey, errorType)` pattern already exists, skip the insert silently. Return `{ inserted: number; skipped: number }`.

Add adapter-level tests for this method using PGLite (follow the pattern in `src/domain/memory/adapters/drizzle-repositories.test.ts`): verify that duplicate phrases are skipped and the counts are accurate.

## Acceptance criteria

- [ ] `MistakePatternRepository` port in `memory/ports.ts` declares `bulkCreateFromKeyPhrases(userId: string, phrases: KeyPhrase[]): Promise<{ inserted: number; skipped: number }>`
- [ ] `DrizzleMistakePatternRepository` implements the method with `onConflictDoNothing`
- [ ] Duplicate `(userId, conceptKey, errorType)` entries are skipped, not errored
- [ ] PGLite-based adapter test covers: all-new phrases inserted, partial duplicates skipped, fully-duplicate batch returns `{ inserted: 0, skipped: n }`
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes

## Blocked by

None — can start immediately
