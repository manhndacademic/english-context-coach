# P0 Learning Loop

## Problem

English Context Coach must become a personal coach for recurring contextual misunderstandings, not a generic translation or quiz app. The current loop ends too early: review can be self-reported, mistake aggregation is phrase-bound, and grading failures can look like learner failures.

## Current Behavior

Lesson attempts create `UserError` rows when grading returns an incorrect result. Those errors aggregate into `MistakePattern` by `normalizedPhrase + senseKey + errorType`. Review lets the learner mark "I remembered" or "Review again soon" without answering a prompt. Generation progress can include model-produced thought summaries.

## Decision

P0 uses this loop:

```text
SourceText
-> Lesson
-> Exercise
-> Attempt
-> UserError
-> MistakeConcept / MistakePattern
-> ReviewExercise
-> ReviewAttempt
-> MasteryState
-> future personalized practice
```

`MistakeConcept` is the scheduled learning unit. `MistakePattern` remains phrase-specific evidence. A review cannot change mastery unless the learner submits an answer and grading succeeds.

## Alternatives Considered

- Keep self-reported review: rejected because it bypasses active recall.
- Keep phrase-level scheduling: rejected because related Vietnamese misunderstandings should reinforce one weakness.
- Reuse lesson `Attempt` for review: rejected because review prompts are privacy-safe concept practice, not lesson-grounded exercise answers.

## Data Model

- `MistakeConcept`: underlying misunderstanding and review seed.
- `MistakePattern`: phrase-specific or focus-specific evidence for a concept.
- `MistakeEvidence`: source-scoped lineage from source, lesson, attempt, and user error to pattern and concept.
- `ReviewAttempt`: auditable answer, prompt snapshot, grading status, result, feedback, and scheduling transition.
- `MasteryState`: explicit concept review state.

## State Transitions

- New concept: `new`.
- New lesson error: `new -> learning`; `mastered -> relearning`; other states stay active and become due.
- Correct review: `new -> learning`, `learning -> reviewing`, `reviewing -> reviewing` until the mastered threshold, then `mastered`, `relearning -> reviewing`.
- Partial review: keeps the concept active, shortens or holds the interval, and does not master.
- Incorrect review: active states become `relearning`.
- Grading failure: no mastery transition and no schedule update.

## Privacy Implications

Long-term review prompts use generalized concept seeds and must not copy original private source sentences. Deleting a source removes only evidence from that source and deletes or archives concepts only when no evidence remains.

## Failure Modes

- AI grading timeout, invalid JSON, or rate limit produces `gradingStatus = failed`, visible retry UI, and no learner penalty.
- Duplicate review submissions reuse an idempotency key and cannot create duplicate scheduling transitions.
- Generation retries emit deterministic progress milestones without provider thought text.

## Acceptance Criteria

- Review requires an answer.
- Review progression is based on graded evidence.
- Concepts aggregate related phrase errors while preserving phrase evidence.
- Source deletion is scoped by explicit lineage.
- Grading failure is visibly separate from incorrect answers.
- Generation progress exposes only application-controlled milestones.
