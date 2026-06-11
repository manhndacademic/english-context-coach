# Application-controlled generation progress

GenerationProgress is application-controlled milestone reporting, not model thought display. We remove learner-facing dependence on provider thought summaries because they can imply access to private reasoning, vary by provider, and are not needed for useful progress feedback.

Considered options: sanitize and keep model thoughts; hide thoughts only in the UI; or stop persisting and streaming them. We chose to stop persisting and streaming them for learner progress. Existing milestone delivery remains durable through `generation_milestones`, SSE, and polling fallback.
