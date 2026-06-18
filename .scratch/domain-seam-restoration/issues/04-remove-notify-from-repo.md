Status: ready-for-agent

## Parent

[.scratch/domain-seam-restoration/PRD.md](../PRD.md)

## What to build

Remove all three calls to `notifyJobQueued()` from inside `DrizzleLessonRepository` (`createSourceTextAndLessonAndJob`, `createLessonAndJob`, `createJob`). After each method returns, the _caller_ (i.e., `LessonGenerationEngine.queue()` and `LessonGenerationEngine.retry()`) must call `notifyJobQueued()` explicitly.

The `notifyJobQueued()` implementation itself does not change. This is a pure call-site move: the side effect is triggered after the repository awaits, so the timing is identical from the outside.

Verify that all existing `LessonGenerationEngine` tests continue to pass and that the app starts background jobs correctly after the change.

## Acceptance criteria

- [ ] `DrizzleLessonRepository` does not call `notifyJobQueued()` anywhere
- [ ] `LessonGenerationEngine.queue()` calls `notifyJobQueued()` after the repository method resolves
- [ ] `LessonGenerationEngine.retry()` calls `notifyJobQueued()` after the repository method resolves
- [ ] All existing `LessonGenerationEngine` tests pass unchanged
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes

## Blocked by

None — can start immediately
