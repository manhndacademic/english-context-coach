Status: ready-for-agent

# PRD: Split MistakePattern from Proactive Review

## Problem Statement

English Context Coach currently uses `MistakePattern` for two different meanings:

1. repeated learner weakness derived from `UserError`
2. proactive review seeded from `KeyPhrase` or manual creation

This breaks the product's core learning loop. A learner studying a phrase proactively is not the same as a learner repeatedly misunderstanding it. Because both flows share the same aggregate, the system cannot cleanly answer questions such as:

- which review items came from repeated mistakes?
- which progress metrics represent actual learner weakness?
- whether a review queue item is evidence-backed memory or proactive practice?

This ambiguity weakens the product moat of Personal Error Memory + Review System, pollutes dashboard metrics, and makes the review domain harder to evolve toward first-class `LessonFocus` support.

## Solution

Separate the two domain meanings.

- `MistakePattern` will mean repeated weakness derived from `UserError` only.
- A new aggregate will represent proactive review seeded from `KeyPhrase` or manual creation.
- Learner-facing surfaces will also separate:
  - mistake review
  - phrase practice

The first PRD covers the smallest safe migration needed to establish this boundary, move legacy phrase-seeded rows out of `MistakePattern`, and preserve scheduling behavior during the transition.

## User Stories

1. As a learner, I want repeated misunderstandings to appear in a mistake review surface, so that I can focus on weaknesses I have actually demonstrated.
2. As a learner, I want proactively seeded phrase practice to appear separately from mistake review, so that I can tell the difference between study and remediation.
3. As a learner, I want the app to stop implying that every reviewable item came from a mistake, so that my progress feels accurate.
4. As a learner, I want repeated mistake counts to exclude proactive phrase practice, so that the dashboard reflects real misunderstandings.
5. As a learner, I want mastered repeated mistakes to reflect weaknesses I overcame, so that visible progress is trustworthy.
6. As a learner, I want phrase practice to remain available after the migration, so that useful study material is not lost.
7. As a learner, I want my existing phrase-seeded review schedule to survive the migration, so that I do not lose progress.
8. As a learner, I want mistake review to prioritize repeated weaknesses before generic phrase practice, so that the product stays aligned with my needs.
9. As a learner, I want `MistakePattern`-based review prompts to continue working after the split, so that my remediation flow does not regress.
10. As a learner, I want proactive phrase practice to keep working after the split, so that the app remains useful even when I have few mistakes.
11. As a learner, I want the history of repeated mistakes to remain intact, so that I can still see evidence of improvement over time.
12. As a learner, I want dashboards and summaries to stop mixing practice queues with mistake memory, so that metrics remain interpretable.
13. As a developer, I want `MistakePattern` to have one meaning only, so that domain rules and metrics remain coherent.
14. As a developer, I want phrase-seeded review to stop using placeholder `errorType` values, so that the model no longer fakes weakness evidence.
15. As a developer, I want migration of legacy `source = "phrase"` rows into a separate aggregate, so that the old mixed semantics are removed instead of hidden.
16. As a developer, I want a compatibility-minimizing rollout, so that the first PR removes the highest ambiguity with limited blast radius.
17. As a developer, I want review queries to distinguish mistake review from phrase practice, so that the UI and metrics read from the right source.
18. As a developer, I want `MistakePattern` creation to remain restricted to `UserError`-derived evidence, so that remediation logic stays honest.
19. As a developer, I want the new proactive review aggregate to reuse scheduling behavior where possible, so that the split does not duplicate infrastructure unnecessarily.
20. As a developer, I want the migration to preserve due dates, interval state, and review prompt state where applicable, so that learner progress is retained.
21. As a product owner, I want the review system to reflect the app's core differentiator, so that repeated mistake mastery remains a reliable north-star signal.
22. As a product owner, I want proactive review and repeated weakness review to be separately measurable, so that future product decisions can target the right loop.
23. As a support operator, I want the system's review queues to be easier to explain to learners, so that feedback and troubleshooting are clearer.
24. As a future implementer, I want the split to create a clean seam for later `LessonFocus` support, so that whole-text misunderstandings can become first-class review targets.

## Implementation Decisions

### Primary seam: review aggregate boundary

The primary seam is the domain boundary around reviewable memory. `MistakePattern` remains the aggregate for repeated weakness derived from `UserError`. A new aggregate will be introduced for proactive review seeded from `KeyPhrase` or manual creation.

This PRD does not prescribe the final name of the new aggregate, but it must not reuse `MistakePattern` language.

### Scope of `MistakePattern`

`MistakePattern` will only be created or updated from evidence-bearing learner behavior:

- incorrect `Attempt` leading to a valid `UserError`
- later `ReviewAttempt` updates against that same repeated weakness

Phrase-seeded practice must no longer pass through `MistakePattern` creation paths.

### Legacy migration strategy

Existing phrase-seeded rows currently stored under `MistakePattern` must be migrated into the new proactive review aggregate during the first PR.

The migration must preserve, where meaningful:

- due date
- interval state
- repetition count
- review prompt content
- review prompt generation status

After migration, queries for `MistakePattern` must stop treating those legacy rows as active mistake memory.

### Separate learner-facing surfaces

The learner-facing review experience will separate:

- mistake review, backed by `MistakePattern`
- phrase practice, backed by the new proactive review aggregate

This is a domain and query separation, not merely a UI filter.

### Shared scheduling engine allowed

The split is semantic first. Scheduling mechanics may still be shared underneath if that reduces duplication. The system may reuse review scheduling behavior, prompt generation infrastructure, and queue processing as long as domain meanings remain separate.

### Metrics correction is part of PR 1

Dashboard, review, and history queries must stop counting proactive phrase practice as repeated mistake memory. Any metric described as repeated mistakes, mastered repeated mistakes, review success against mistake memory, or similar must read from the `MistakePattern` domain only.

### Compatibility policy

Short-lived compatibility code is allowed only where necessary to roll out safely. The first PR should establish the new boundary and leave as little semantic leakage as possible. Remaining cleanup belongs to the second PR.

### Schema and persistence

The first PR may introduce new persistence structures for the proactive review aggregate. It should avoid broad normalization or unrelated schema redesign. The minimum schema change that cleanly separates domain meaning is preferred.

### API and service behavior

Services that currently read or write phrase-seeded review through `MistakePattern` must be redirected to the new aggregate. Read paths and write paths should both be corrected in the same PR so the system does not continue producing mixed semantics.

## Testing Decisions

### What makes a good test here

A good test asserts on external domain behavior:

- whether repeated mistakes create or update `MistakePattern`
- whether phrase-seeded practice creates the proactive review aggregate instead
- whether queues, dashboards, and history separate those concepts correctly
- whether legacy phrase-seeded data is preserved after migration

Bad tests assert that a specific repository method or migration helper was called internally. The intent is to preserve domain meaning and learner-visible behavior, not implementation wiring.

### Modules to test

- the memory domain engine paths that create repeated weakness from `UserError`
- the new proactive review creation path
- review query services or repositories that back mistake review and phrase practice
- dashboard/history metrics that distinguish the two surfaces
- the migration path for legacy phrase-seeded rows

### Prior art

Use the existing memory engine tests and Drizzle repository tests as the prior art. Existing review page, review session, and dashboard tests should be extended where possible rather than replaced with lower-level test seams.

### Manual verification

- create a repeated learner misunderstanding and verify it appears only in mistake review
- create proactive phrase practice and verify it appears only in phrase practice
- confirm dashboard metrics for repeated mistakes exclude proactive phrase practice
- verify migrated legacy phrase-seeded rows remain accessible in phrase practice with preserved schedule state

## Out of Scope

- introducing first-class `LessonFocus` review targeting
- changing `MistakePattern` identity to be sense-aware
- introducing explicit `Concept` and `Sense` domain objects
- `SourceMeaning` value object work
- broad glossary cleanup or ADR updates beyond what is minimally needed for implementation
- redesigning the overall review scheduling algorithm

## Further Notes

This PRD intentionally optimizes for the smallest safe migration. It removes the highest-impact semantic ambiguity first, while creating a clean seam for later work on `LessonFocus`, `Concept`, `Sense`, and glossary cleanup.

This PRD should be implemented before any attempt to make `LessonFocus` first-class in review. Otherwise the system will deepen the phrase-centric bias instead of removing it.
