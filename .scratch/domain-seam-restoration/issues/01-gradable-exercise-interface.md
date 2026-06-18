Status: ready-for-agent

## Parent

[.scratch/domain-seam-restoration/PRD.md](../PRD.md)

## What to build

Define a minimal `GradableExercise` interface inside `memory/ports.ts` (or a new type file in the memory domain) containing only the fields that `GradingEngine.grade()` actually needs: `type`, `promptVi`, `promptEn`, `choices`, `correctAnswer`, `acceptableAnswers`, `rubricVi`.

Update the `GradingEngine` port to accept `GradableExercise` instead of importing `Exercise` from `lesson/ports`. The `DrizzleGradingEngine` adapter continues to receive the full `Exercise` type from Drizzle — the narrowing happens at the port boundary only, so no adapter logic changes.

Remove the cross-domain import of `Exercise` from any file inside the `memory` domain.

## Acceptance criteria

- [ ] A `GradableExercise` interface is defined inside the memory domain (no import from the lesson domain)
- [ ] `GradingEngine` port signature references `GradableExercise`, not `Exercise` from `lesson/ports`
- [ ] No file inside `src/domain/memory/` imports from `src/domain/lesson/`
- [ ] `bun run typecheck` passes with zero errors
- [ ] `bun run test` passes with zero failures
- [ ] `bun run build` succeeds

## Blocked by

None — can start immediately
