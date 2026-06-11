# Grading failure and idempotent retry

Grading failure is a system outcome, not a learner mistake. Lesson and review submissions store explicit grading status and use idempotency keys so retries can complete the same answer without creating duplicate attempts, UserErrors, or evidence.

Considered options: map provider failures to score 0; ask learners to resubmit a new answer; or persist a retryable failed grading state. We chose retryable failed grading because it protects mastery and mistake aggregation from provider outages while preserving the learner's submitted answer.

## P0 correction

### Transaction boundary
AI grading happens outside the database transaction. Finalization then locks the attempt, re-checks terminal state, upserts the concept, inserts `UserError` once per attempt, upserts pattern/evidence, and only then marks the attempt `succeeded`. Failed grading stores a failed system state and creates no mistake memory.

### Database protections
`user_errors_attempt_unique` enforces at most one `UserError` for a lesson attempt. `mistake_evidence_user_error_unique` enforces at most one evidence record for that error. Pattern occurrence counts increment only when a new `UserError` is created.

### Failure modes
If finalization fails, the attempt is not marked fully succeeded and can be retried. If duplicate finalizers race, the row lock and unique indexes collapse them into one logical result.
