# Add AttemptMemoryTransition contract

Status: done

## Goal

Create the initial `AttemptMemoryTransition` module shape without changing runtime behavior.

## Scope

- Add `src/domain/memory/attempt-memory-transition.ts`.
- Add domain-rich input/output types.
- Add `MIN_USER_ERROR_CONFIDENCE = 70` in the Memory domain.
- Add focused tests for the contract-level decisions that do not need DB behavior.

## Acceptance criteria

- The new module can be instantiated with repositories/adapters needed for later tasks.
- No production caller is rewired yet.
- Tests cover the confidence gate constant and no-save branches at the pure decision level where possible.

## Manual test

Run:

```bash
bun run lint
bun run test
```

## Notes

Keep `AttemptMemoryTransition` out of `CONTEXT.md`; it is architecture language, not learner-facing domain language.
