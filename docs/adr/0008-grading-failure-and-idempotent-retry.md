# Grading failure and idempotent retry

Grading failure is a system outcome, not a learner mistake. Lesson and review submissions store explicit grading status and use idempotency keys so retries can complete the same answer without creating duplicate attempts, UserErrors, or evidence.

Considered options: map provider failures to score 0; ask learners to resubmit a new answer; or persist a retryable failed grading state. We chose retryable failed grading because it protects mastery and mistake aggregation from provider outages while preserving the learner's submitted answer.
