# Wire DefaultLearnerMemoryEngine to AttemptMemoryTransition

Status: done

## Goal

Use `AttemptMemoryTransition` from `DefaultLearnerMemoryEngine.submitAttempt`.

## Scope

- `DefaultLearnerMemoryEngine` still finds the `Exercise`.
- `DefaultLearnerMemoryEngine` still calls `GradingEngine` outside the transaction.
- If grading returns a system failure, do not persist an `Attempt`.
- Run `AttemptMemoryTransition` inside `TransactionCoordinator.runInTransaction`.
- Dispatch returned `reviewPromptJob` after the transaction.
- Map the transition result to `AttemptFormResult`.

## Acceptance criteria

- Existing `DefaultLearnerMemoryEngine` tests pass.
- Tests confirm review prompt dispatch happens after transition result.
- Engine tests become orchestration-focused, not rule-heavy.
- No learner-visible behavior changes except system grading failures not creating attempts.

## Manual test

Run:

```bash
bun run lint
bun run test
```
