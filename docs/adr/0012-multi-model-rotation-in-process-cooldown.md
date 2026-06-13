# Multi-model rotation with in-process cooldown

When the AI provider returns 429 (rate limit) or 503 (unavailable) for the configured model, the system previously had to re-queue the generation job and wait for the next worker tick. This caused meaningful latency spikes for learners during peak demand.

We decided to add model rotation alongside the existing API key rotation: `ProviderRotationPool` holds an ordered list of models per `modelKind` (analysis, fast) and tracks per-model cooldown in process memory. When a model is rate-limited, the pool marks it with a 30-second cooldown and immediately falls back to the next model in priority order. Both key and model rotation happen inside the same `callGeminiWithRetry` loop, so the learner's request completes without job re-queue in most transient failure cases.

We chose in-process (singleton) state over database-backed state because model cooldowns are short-lived (30 seconds), do not need to survive worker restarts, and adding a DB round-trip per AI call would negate the performance gain. The `ApiRotationPool` concept in CONTEXT.md was extended to cover both dimensions (key + model) rather than introducing a separate `ModelPool` concept, since both address the same concern: ensuring AI provider availability for learner requests.

## Considered Options

- Re-queue and wait: existing behaviour — learner sees multi-second stall during peak demand.
- Database-backed model state: survives restarts but adds latency and schema migrations for short-lived cooldowns.
- Separate ModelPool concept: parallel to ApiRotationPool — rejected because both mechanisms serve the same invariant and a single concept is easier to reason about.
