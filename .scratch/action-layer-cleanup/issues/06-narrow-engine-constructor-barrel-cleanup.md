Status: ready-for-agent

## Parent

[.scratch/action-layer-cleanup/PRD.md](../PRD.md)

## What to build

Two related structural fixes to the `lesson` domain:

**1. Narrow `DefaultLessonGenerationEngine` constructor**: Change the constructor signature from accepting the composite `LessonRepository` to accepting the five focused sub-interfaces as separate parameters: `SourceTextRepository`, `LessonContentRepository`, `GenerationJobRepository`, `GenerationProgressRepository`, `LessonTransactionRepository`. The factory function in `lesson/index.ts` passes the single `DrizzleLessonRepository` instance at each parameter — since the adapter satisfies all five sub-interfaces, no new adapter is needed. The sub-interfaces are already defined in `ports.ts` but not used at injection sites.

**2. Remove concrete class exports from `lesson/index.ts`**: `DrizzleLessonRepository`, `GeminiGenerationEngine`, and `DefaultLessonGenerationEngine` must be removed from the `lesson/index.ts` barrel export. Any test files that import these directly should update their import paths to the adapter subdirectory (e.g., `lesson/adapters/drizzle-repositories`). The public API of `lesson/index.ts` should only export factory functions and port interfaces.

Verify that existing `LessonGenerationEngine` tests pass with no behavior changes — the constructor narrowing is a type-level change only.

## Acceptance criteria

- [ ] `DefaultLessonGenerationEngine` constructor accepts the five focused sub-interfaces, not the composite `LessonRepository`
- [ ] Factory function in `lesson/index.ts` passes `DrizzleLessonRepository` at each of the five narrower parameter types
- [ ] All existing `LessonGenerationEngine` tests pass unchanged
- [ ] `DrizzleLessonRepository`, `GeminiGenerationEngine`, and `DefaultLessonGenerationEngine` are no longer exported from `lesson/index.ts`
- [ ] Any test files that previously imported concrete classes from `lesson/index.ts` now import from adapter subdirectory paths
- [ ] No callers outside `lesson/index.ts` are broken by the barrel cleanup
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes

## Blocked by

None — can start immediately
