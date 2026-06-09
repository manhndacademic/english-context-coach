# Durable generation thoughts

Lesson generation should show persisted `GenerationThought` summaries alongside durable `GenerationMilestone` history. Milestones remain the source of truth for what phase generation has reached, while thoughts expose provider-supplied summaries of what the model is considering right now; the app must not store raw chain-of-thought or hidden reasoning traces.

Persisting these summaries keeps the learner experience coherent across refreshes, reconnects, worker restarts, and late page opens. This deliberately accepts a larger privacy surface than live-only progress, so generated thoughts should be treated as learner-visible Lesson generation data and filtered for source-identifying content before storage.
