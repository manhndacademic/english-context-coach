Status: ready-for-agent

## Parent

[.scratch/domain-seam-restoration/PRD.md](../PRD.md)

## What to build

Move the key phrase deduplication (`dedupeKeyPhrases()`) and normalization helpers from inside `DrizzleLessonRepository.saveAnalysis()` into `LessonGenerationEngine.processNext()`, executed before calling `repo.saveAnalysis()`.

The `saveAnalysis()` method signature does not change — it continues to accept `SaveAnalysisInput`. The data passed in will already be deduplicated and normalized at the call site inside the engine.

Add or extend unit tests on `LessonGenerationEngine` (via its interface, using in-memory adapters) to verify that `processNext()` produces correctly deduplicated and normalized output. These tests should cover: duplicate phrases collapsed, edge-case normalization preserved, and the final `saveAnalysis()` call receives the cleaned data.

## Acceptance criteria

- [ ] `DrizzleLessonRepository.saveAnalysis()` does not call `dedupeKeyPhrases()` or any normalization helper
- [ ] `LessonGenerationEngine.processNext()` calls `dedupeKeyPhrases()` and normalization helpers before calling `repo.saveAnalysis()`
- [ ] New/extended engine tests assert on deduplication and normalization behavior through the engine interface (not the adapter)
- [ ] All existing `LessonGenerationEngine` tests pass
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes

## Blocked by

None — can start immediately
