Status: ready-for-agent

## Parent

[.scratch/domain-seam-restoration/PRD.md](../PRD.md)

## What to build

Add a new method `scrubSensitiveContentForSourceText(userId, sourceTextId)` to the `MistakePatternRepository` port in `memory/ports.ts` and implement it in `DrizzleMistakePatternRepository`.

The new method must replicate the scrubbing logic currently in `DrizzleLessonRepository.deleteSourceText()`: load all `MistakePattern` rows for the user that are linked to the given `sourceTextId` and clear (null-out or redact) any fields that contain sensitive content derived from that source text.

After the method exists, update `LessonGenerationEngine` (or a new deletion service) to orchestrate deletion: call `lessonRepo.deleteSourceText()` then `memoryRepo.scrubSensitiveContentForSourceText()` in sequence. Remove the cross-domain `textProcessor.shouldScrubMistakePattern()` call from `DrizzleLessonRepository`.

Add a PGLite adapter test verifying that scrubbing clears the correct fields.

## Acceptance criteria

- [ ] `MistakePatternRepository` port declares `scrubSensitiveContentForSourceText(userId: string, sourceTextId: string): Promise<void>`
- [ ] `DrizzleLessonRepository.deleteSourceText()` no longer calls `textProcessor.shouldScrubMistakePattern()` and no longer imports from the memory domain
- [ ] Scrubbing is orchestrated by the engine (or deletion service), not the lesson repository adapter
- [ ] Privacy invariant preserved: deleting a SourceText still results in associated MistakePattern content being scrubbed (manual test in the running app)
- [ ] PGLite adapter test confirms scrubbing clears the correct fields
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes

## Blocked by

None — can start immediately
