# Move UserError and MistakePattern persistence transition

Status: done

## Goal

Make `AttemptMemoryTransition` own the persistence transition from `Attempt` to `UserError` and `MistakePattern`.

## Scope

- Inside the transaction, create the `Attempt`.
- If `grade.error.shouldSave = false`, stop after saving the `Attempt`.
- If confidence is below `MIN_USER_ERROR_CONFIDENCE`, stop after saving the `Attempt`.
- If saving an error, create `UserError`.
- Match repeated `MistakePattern` by `userId + conceptKey + errorType`.
- New pattern creates a `MistakePattern`.
- Existing pattern uses aggregate behavior to increment occurrence.
- Mastered pattern missed again is reactivated with immediate `dueAt`.
- Repository saves state; aggregate owns occurrence/reactivation rules.

## Acceptance criteria

- Tests cover new `MistakePattern`.
- Tests cover repeated `MistakePattern`.
- Tests cover mastered reactivation.
- Tests cover `shouldSave = false`.
- Tests cover low confidence.
- Avoid double increment with repository upsert behavior.

## Manual test

Run:

```bash
bun run test src/domain/memory
```
