# ReviewAttempt and MasteryState

Review uses first-class ReviewAttempts and explicit MistakeConcept MasteryState instead of self-reported MistakePattern buttons. This is harder than updating a due date directly, but it makes review auditable and ensures mastery is based on graded active-recall evidence.

Considered options: reuse lesson Attempts; keep self-report buttons as a fallback; or add a review-specific attempt model. We chose a review-specific model because review prompts are privacy-safe concept practice, not source-grounded lesson exercises, and grading failure must not look like learner failure.
