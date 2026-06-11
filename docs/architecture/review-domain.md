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
