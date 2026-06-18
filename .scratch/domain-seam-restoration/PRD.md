Status: ready-for-agent

# PRD: Domain Seam Restoration

Infrastructure adapters (repositories) are currently performing the work of domain engines: triggering side effects, embedding business rules, and having knowledge of cross-domain objects. The goal of this PRD is to restore these responsibilities to their proper layers.

## Problem Statement

Currently, three architectural issues are breaking the seam between domain engines and infrastructure adapters:

1. **`addPhrasesToReviewQueue` lives in the wrong layer**: Domain logic (creating MistakePattern SRS cards from KeyPhrases) is placed in `lib/phrases/` and directly imports `db` — making it impossible to test without a real database. `LessonGenerationEngine` has to import from a utility library instead of invoking via a domain port.

2. **`DrizzleLessonRepository` does too much**: This repository calls `notifyJobQueued()` (a side effect), runs `dedupeKeyPhrases()` + normalization (business rules), and calls `textProcessor.shouldScrubMistakePattern()` on memory-domain objects (cross-domain knowledge) — all of which are the responsibilities of the engine, not the repository.

3. **Circular cross-domain knowledge**: The `lesson` adapter has knowledge of `MistakePattern` and `UserError` from the memory domain. The `memory` ports import `Exercise` from the lesson domain. These two domains have a conceptual circularity that does not properly reflect the dependency direction.

Consequence: it is impossible to test engine logic without running the entire DB stack, bugs in deduplication/normalization are difficult to locate because the logic is inside the adapter, and cross-domain changes can easily cause unexpected breakages elsewhere.

## Solution

Move each responsibility to its appropriate layer:

- Logic for creating SRS cards from KeyPhrases → `MistakePatternRepository` port (new method: `bulkCreateFromKeyPhrases`)
- `notifyJobQueued()` after job creation → `LessonGenerationEngine` calls this after awaiting the transaction (`tx`)
- `dedupeKeyPhrases()` + normalization → `LessonGenerationEngine.processNext()` pipeline, before calling `repo.saveAnalysis()`
- Cross-domain scrubbing when deleting a SourceText → new method on the memory side, orchestrated by the engine
- `Exercise` cross-import in memory ports → extract a minimal `GradableExercise` interface inside the memory domain

Result: engines can be tested through their interfaces using in-memory adapters. Repositories will only handle persistence and queries, not orchestration.

## User Stories

1. As a developer, I want `LessonGenerationEngine.processNext()` to call `notifyJobQueued()` after committing a job, so that the repository has no knowledge of side effects.
2. As a developer, I want key phrase deduplication and normalization to happen inside the engine before calling `repo.saveAnalysis()`, so that business rules are testable without a real database.
3. As a developer, I want `LearnerMemoryEngine` to expose a method that bulk-creates SRS cards from KeyPhrases, so that lesson generation can trigger this via the memory domain port instead of a raw DB utility.
4. As a developer, I want the memory domain port for bulk SRS card creation to be testable with an in-memory adapter, so that I can write fast unit tests without a running Postgres instance.
5. As a developer, I want `DrizzleLessonRepository.deleteSourceText()` to not call `textProcessor.shouldScrubMistakePattern()`, so that the lesson repository does not need to know about memory domain objects.
6. As a developer, I want SourceText deletion scrubbing to be orchestrated by the engine (or a deletion service), so that the lesson and memory domains remain independent of each other's internal types.
7. As a developer, I want `memory/ports.ts` to define a minimal `GradableExercise` interface instead of importing `Exercise` from the lesson domain, so that the memory domain does not depend on the lesson domain's full type definition.
8. As a developer, I want `DrizzleLessonRepository` to not call `notifyJobQueued()` inside `createSourceTextAndLessonAndJob()`, `createLessonAndJob()`, or `createJob()`, so that callers control when the worker is notified.
9. As a developer, I want `DrizzleLessonRepository.saveAnalysis()` to receive already-deduplicated and already-normalized phrases as input, so that the adapter is a pure persistence layer.
10. As a developer, I want existing tests for `LessonGenerationEngine` to continue passing after the refactor, so that the behavior is preserved even as the implementation moves layers.
11. As a developer, I want new unit tests for the deduplication and normalization logic to run against the engine interface, not the repository, so that the tests survive internal refactors.
12. As a developer, I want `MistakePatternRepository.bulkCreateFromKeyPhrases()` to apply the same deduplication rule as the current implementation (skip if `conceptKey` already has a card), so that learner data is not duplicated.
13. As a developer, I want `LessonGenerationEngine` to call `memoryEngine.bulkCreateSrsCardsFromKeyPhrases()` (or equivalent) after saving analysis, so that the SRS pipeline is triggered through the domain engine seam.
14. As a developer, I want the memory engine factory to expose the bulk SRS creation operation as part of its public interface, so that callers do not need to go through the repository directly.
15. As a developer, I want the deletion of a SourceText to still scrub sensitive MistakePattern content after this refactor, so that the privacy invariant is preserved.

## Implementation Decisions

### Seam: `LearnerMemoryEngine` interface (primary test surface)

The primary seam for changes is the `LearnerMemoryEngine` interface in `memory/types.ts`. A new method will be added:

```
bulkCreateSrsCardsFromKeyPhrases(userId, keyPhrases): Promise<{ inserted: number; skipped: number }>
```

The `LessonGenerationEngine` will call this method after saving analysis, replacing the current direct call to the `lib/phrases` utility.

### Seam: `MistakePatternRepository` (secondary seam for new persistence method)

A new method will be added to `MistakePatternRepository` in `memory/ports.ts`:

```
bulkCreateFromKeyPhrases(userId, phrases): Promise<{ inserted: number; skipped: number }>
```

The same deduplication rule applies: if a `(userId, conceptKey, errorType)` pattern already exists, skip the insert. The Drizzle adapter implements this with `onConflictDoNothing`.

### Side effect removal from `DrizzleLessonRepository`

All three calls to `notifyJobQueued()` inside `DrizzleLessonRepository` (`createSourceTextAndLessonAndJob`, `createLessonAndJob`, `createJob`) will be removed. `LessonGenerationEngine.queue()` and `LessonGenerationEngine.retry()` will call `notifyJobQueued()` after awaiting the repository method.

### Dedup + normalization moved to engine

`LessonGenerationEngine.processNext()` will call `dedupeKeyPhrases()` and the normalization helpers on the AI-generated analysis before calling `repo.saveAnalysis()`. The `saveAnalysis()` method signature does not change — it continues to accept `SaveAnalysisInput` — but the data passed in will already be deduplicated and normalized.

### Cross-domain scrubbing strategy

`DrizzleLessonRepository.deleteSourceText()` currently loads `mistakePatterns` and calls `textProcessor.shouldScrubMistakePattern()`. This logic will move into a new method on `MistakePatternRepository`: `scrubSensitiveContentForSourceText(userId, sourceTextId)`. `LessonGenerationEngine` will orchestrate the deletion by calling both `lessonRepo.deleteSourceText()` and `memoryRepo.scrubSensitiveContentForSourceText()` in sequence.

### `GradableExercise` minimal interface in memory domain

A new minimal interface `GradableExercise` will be defined in `memory/ports.ts` containing only the fields that `GradingEngine.grade()` actually needs (type, promptVi, promptEn, choices, correctAnswer, acceptableAnswers, rubricVi). The `GradingEngine` port will accept `GradableExercise` instead of importing `Exercise` from `lesson/ports`. `DrizzleGradingEngine` will continue to receive the full `Exercise` type from Drizzle — the narrowing happens at the port boundary.

### No schema changes

No database schema changes are required for this PRD. All changes are code-layer only.

### No new BullMQ queues or workers

The `notifyJobQueued()` function is moved in call-site only — its implementation does not change.

## Testing Decisions

### What makes a good test here

# What makes a good test here

Tests should assert on observable outcomes through the engine interface, not on internal state of adapters. A test that verifies `LessonGenerationEngine.processNext()` correctly deduplicated phrases is a good test. A test that verifies `DrizzleLessonRepository.saveAnalysis()` ran `dedupeKeyPhrases()` internally is a bad test — it is testing implementation, not behavior.

### Modules to test

- `LearnerMemoryEngine` via its interface — new `bulkCreateSrsCardsFromKeyPhrases` behavior
- `LessonGenerationEngine` via its interface — `processNext()` still produces the correct output after normalization is moved from adapter to engine
- `MistakePatternRepository.bulkCreateFromKeyPhrases` via its Drizzle adapter — using PGLite as the local-substitutable test stand-in (same pattern as existing `drizzle-repositories.test.ts`)
- `MistakePatternRepository.scrubSensitiveContentForSourceText` — same adapter test approach

### Prior art

- `src/domain/memory/engine.test.ts` — 35k bytes, tests `LearnerMemoryEngine` through its interface with mocked ports; follow the same pattern for the new `bulkCreateSrsCardsFromKeyPhrases` method
- `src/domain/memory/adapters/drizzle-repositories.test.ts` — tests the Drizzle adapter using PGLite; follow this for the new `bulkCreateFromKeyPhrases` adapter test
- `src/domain/lesson/engine.test.ts` — tests `LessonGenerationEngine` through its interface; extend existing tests to cover the moved dedup/normalization path

## Out of Scope

- Splitting `DrizzleLessonRepository` into 5 smaller adapter classes (each implementing one sub-interface) — the internal grouping by comments is sufficient for now
- Narrowing constructor parameters at `LessonGenerationEngine` injection sites to use the focused sub-interfaces instead of the composite `LessonRepository` — tracked in PRD 2
- Any changes to the BullMQ queue or worker infrastructure
- Any UI-facing changes
- Changing the `LessonRepository` composite interface itself — it stays for backward compatibility

## Further Notes

This PRD covers the three findings from the codebase design audit with the highest architectural impact: Finding 1 (`addPhrasesToReviewQueue`), Finding 3 (`DrizzleLessonRepository` monolith side effects), and Finding 5 (circular cross-domain knowledge).

The privacy invariant for SourceText deletion must be preserved end-to-end. A manual test should verify that deleting a SourceText still results in the associated MistakePattern content being scrubbed.

The `lib/phrases/addPhrasesToReviewQueue.ts` file should be deleted after the new `MistakePatternRepository` method is wired up and all call sites are updated.
