# Durable generation progress

Lesson generation progress is represented as durable `GenerationMilestone` history in Postgres, keyed to both the `Lesson` and the `GenerationJob`. The Lesson page streams those milestones with SSE for a live learner experience, keeps HTTP polling as a fallback, and initially has the SSE route poll Postgres for new milestones instead of introducing WebSocket or a separate pub/sub channel.

This keeps Postgres as the source of truth across browser refreshes, reconnects, worker restarts, and late page opens. SSE fits the one-way nature of learner-visible progress, while durable milestones avoid fake percentage progress and let the UI refresh only when saved analysis or saved exercises make new Lesson content available.
