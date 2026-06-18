Status: ready-for-agent

## Parent

[.scratch/action-layer-cleanup/PRD.md](../PRD.md)

## What to build

Two quick prefactoring steps before the heavier repository extractions:

**1. Delete `retryExercisesAction`**: `retryExercisesAction` in `source-texts.ts` is byte-for-byte identical to `retryLessonGenerationAction`. Run a grep for all import and usage sites of `retryExercisesAction`, update them to use `retryLessonGenerationAction`, and delete the duplicate.

**2. Type-tighten `validatedAction`**: Replace the `user: any` parameter in `validatedAction`'s handler signature with the `SessionUser` type (the return type of `requireUser()`). No runtime behaviour changes — this is a type-level fix only. Ensure the same type is used at `requireAdmin()` call sites.

## Acceptance criteria

- [ ] `retryExercisesAction` is deleted; no remaining imports or usages in the codebase
- [ ] All former call sites of `retryExercisesAction` now reference `retryLessonGenerationAction`
- [ ] `validatedAction` handler receives `user: SessionUser`, not `user: any`
- [ ] `SessionUser` is the same type returned by `requireUser()` — no casting required at call sites
- [ ] `bun run typecheck` passes with zero errors
- [ ] `bun run test` passes

## Blocked by

None — can start immediately
