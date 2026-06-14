# Tighten tests and remove duplicated logic

Status: done

## Goal

Finish the refactor by deleting duplicated rule logic and making test seams reflect the new module shape.

## Scope

- Remove old duplicated memory-transition logic from `DefaultLearnerMemoryEngine.submitAttempt`.
- Keep `DefaultLearnerMemoryEngine` tests focused on orchestration.
- Keep `AttemptMemoryTransition` tests focused on memory rules.
- Search for accidental duplicated confidence gates or `Concept` fallback logic.
- Confirm no temporary debug logs remain.

## Acceptance criteria

- `DefaultLearnerMemoryEngine.submitAttempt` is shorter and no longer owns `Concept` resolution or `MistakePattern` transition rules.
- `AttemptMemoryTransition` is the main test surface for Attempt-to-memory behavior.
- No duplicated `MIN_USER_ERROR_CONFIDENCE` literal outside the domain constant.
- Full verification passes.

## Manual test

Run:

```bash
bun run lint
bun run test
bun run build
```
