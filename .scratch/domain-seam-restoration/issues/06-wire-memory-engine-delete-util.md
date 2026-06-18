Status: ready-for-agent

## Parent

[.scratch/domain-seam-restoration/PRD.md](../PRD.md)

## What to build

Add `bulkCreateSrsCardsFromKeyPhrases(userId, keyPhrases)` as a public method on `LearnerMemoryEngine` (both the interface in `memory/types.ts` and the default implementation). The method delegates to `MistakePatternRepository.bulkCreateFromKeyPhrases()` (introduced in issue 02).

Update `LessonGenerationEngine.processNext()` to call `memoryEngine.bulkCreateSrsCardsFromKeyPhrases()` after saving analysis, replacing the current direct call to the `lib/phrases/addPhrasesToReviewQueue` utility.

Delete `lib/phrases/addPhrasesToReviewQueue.ts` (and the `lib/phrases/` directory if it becomes empty). Update any remaining call sites.

Add a test for the new `LearnerMemoryEngine` method following the pattern in `src/domain/memory/engine.test.ts` (mocked ports, asserts on observable output).

## Acceptance criteria

- [ ] `LearnerMemoryEngine` interface declares `bulkCreateSrsCardsFromKeyPhrases(userId: string, keyPhrases: KeyPhrase[]): Promise<{ inserted: number; skipped: number }>`
- [ ] Default `LearnerMemoryEngine` implementation delegates to `MistakePatternRepository.bulkCreateFromKeyPhrases()`
- [ ] `LessonGenerationEngine.processNext()` calls `memoryEngine.bulkCreateSrsCardsFromKeyPhrases()` — no direct call to `lib/phrases/addPhrasesToReviewQueue`
- [ ] `lib/phrases/addPhrasesToReviewQueue.ts` is deleted; no remaining imports of this file
- [ ] New engine test covers: phrases inserted, duplicates skipped, return value propagated
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes

## Blocked by

- [02-bulk-create-from-key-phrases.md](02-bulk-create-from-key-phrases.md) — port method and Drizzle adapter must exist first
- [05-move-dedup-to-engine.md](05-move-dedup-to-engine.md) — engine pipeline must process deduplicated phrases before calling the memory engine
