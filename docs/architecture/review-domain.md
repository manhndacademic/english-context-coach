# Review Domain

## Problem

Review needs auditable active recall, explicit mastery states, and deterministic scheduling rules. The old server action directly changed `MistakePattern.intervalDays` based on a self-reported button.

## Current Behavior

`MistakePattern` stores phrase aggregation, interval, due date, and review timestamps. Review actions update those fields without a submitted answer or grading record.

## Decision

Review operates on `MistakeConcept`. Each due concept produces a `ReviewExercise` prompt snapshot. Each submitted answer creates or reuses one `ReviewAttempt`. Scheduling and mastery transitions are pure domain functions and are applied only after `gradingStatus = succeeded`.

## Alternatives Considered

- Store review answers in lesson `attempts`: rejected because review is concept-level and privacy-safe.
- Keep scheduling on `MistakePattern`: rejected because phrase-level evidence should not fragment concept mastery.
- Let AI decide intervals: rejected because scheduling must be deterministic and testable.

## Data Model

`review_attempts` includes `userId`, `mistakeConceptId`, optional `mistakePatternId`, `reviewExerciseType`, `promptSnapshot`, `answer`, `score`, `result`, `feedbackVi`, `gradingStatus`, previous and next mastery states, previous and next intervals, `idempotencyKey`, and timestamps.

## State Transitions

Mastery states are `new`, `learning`, `reviewing`, `mastered`, and `relearning`.

Review results are `correct`, `partially_correct`, `incorrect`, and `grading_failed`.

Successful grading transitions:

- Correct from `new` becomes `learning`, interval 1 day.
- Correct from `learning` becomes `reviewing`, interval 3 days.
- Correct from `reviewing` progresses through 7 and 14 days; at 14 days it becomes `mastered`.
- Correct from `relearning` becomes `reviewing`, interval 3 days.
- Partial keeps active learning/reviewing state and schedules 1 day.
- Incorrect becomes `relearning` and schedules 1 day.

Failed grading transitions:

- No mastery change.
- No interval change.
- No due date change.

## Privacy Implications

Prompt snapshots may contain a generalized phrase, concept title, safe cloze, choices, and rubric. They must not include original source sentences or sensitive identifiers.

## Failure Modes

- Objective review grading fails closed only when the prompt snapshot is invalid.
- AI review grading failure stores a retryable failed attempt without changing mastery.
- Duplicate idempotency keys return the existing attempt.

## Acceptance Criteria

- No self-reported path can update mastery.
- Every review answer has an auditable `ReviewAttempt`.
- Scheduling rules are covered by unit tests.

## P0 correction: attempts, mastery, and result visibility

### Domain invariants
- `ReviewAttempt` records one learner submission operation for one `MistakeConcept`; it is not a unique answer string.
- `Attempt` records one lesson-practice submission operation for one `Exercise`; repeated practice with the same text is valid.
- Grading retry reuses the existing attempt and saved answer.
- Mastery is updated once for a successfully graded review attempt and is unchanged for grading failures.
- Before submission, review UI may show only prompt, type, category, and mastery metadata; answer/explanation fields are post-result surfaces.

### Transaction and concurrency boundaries
Review submission inserts or locks the submission attempt by idempotency key before updating it. Duplicate delivery that races on the same idempotency key can only produce one row, and a later duplicate sees the already-succeeded attempt rather than scheduling mastery again. Lesson finalization locks the attempt and writes grading plus mistake-memory records in one transaction after the slow AI grading call completes.

### State transitions
`pending` or `failed` attempts may be retried. `succeeded` attempts are terminal for the same submission id. Review result pages render succeeded, partial, incorrect, and grading-failed states independently from the current due queue so feedback does not disappear when `dueAt` changes.
