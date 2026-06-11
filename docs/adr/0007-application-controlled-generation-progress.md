# Application-controlled generation progress

GenerationProgress is application-controlled milestone reporting, not model thought display. We remove learner-facing dependence on provider thought summaries because they can imply access to private reasoning, vary by provider, and are not needed for useful progress feedback.

Considered options: sanitize and keep model thoughts; hide thoughts only in the UI; or stop persisting and streaming them. We chose to stop persisting and streaming them for learner progress. Existing milestone delivery remains durable through `generation_milestones`, SSE, and polling fallback.

## P0 correction

### Problem
The worker emitted conceptual analysis milestones such as text-type and confusing-phrase steps immediately before one combined provider request, implying processing boundaries that did not exist.

### Decision
The worker now emits only application-observable boundaries for the combined analysis request: analysis started, analysis saving, analysis saved, exercise generation started, validation, saved, retrying, completed, or failed. Historical enum values remain for compatibility, but new worker execution does not invent detailed sub-stages.
