# ReviewAttempt and MasteryState

Review uses first-class ReviewAttempts and explicit MistakeConcept MasteryState instead of self-reported MistakePattern buttons. This is harder than updating a due date directly, but it makes review auditable and ensures mastery is based on graded active-recall evidence.

Considered options: reuse lesson Attempts; keep self-report buttons as a fallback; or add a review-specific attempt model. We chose a review-specific model because review prompts are privacy-safe concept practice, not source-grounded lesson exercises, and grading failure must not look like learner failure.

## P0 correction

### Problem
Answer-hash idempotency made repeated learning indistinguishable from duplicate HTTP delivery, and successful scheduling could hide the result card immediately.

### Decision
Use submission-scoped idempotency keys and route learners to a durable review result page. A review session id separates later active-recall sessions; a submission id deduplicates one browser submission. Retry grading references the existing attempt id.

### Consequences
The same answer can legitimately progress mastery in a later session. Duplicate delivery of the same form does not duplicate records. Failed grading is retryable without changing mastery.
