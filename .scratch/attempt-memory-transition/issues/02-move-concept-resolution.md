# Move Concept resolution into AttemptMemoryTransition

Status: done

## Goal

Move target and `Concept` resolution out of `DefaultLearnerMemoryEngine.submitAttempt`.

## Scope

- `AttemptMemoryTransition` resolves `KeyPhrase` and `LessonFocus` itself.
- `KeyPhrase.conceptKey`, `conceptPhrase`, and `conceptMeaningVi` are authoritative when present.
- `LessonFocus.conceptKey`, `conceptPhrase`, and `conceptMeaningVi` are authoritative when present.
- Fallback `Concept` uses `exercise.correctAnswer ?? exercise.promptEn ?? exercise.promptVi` before `grade.error.targetItem`.
- AI grading cannot override `Concept`.

## Acceptance criteria

- Tests cover KeyPhrase wins.
- Tests cover LessonFocus wins.
- Tests cover deterministic fallback when neither exists.
- `DefaultLearnerMemoryEngine.submitAttempt` no longer contains duplicated `Concept` fallback logic after wiring in a later task.

## Manual test

Run:

```bash
bun run test src/domain/memory
```
