Status: ready-for-agent

# Introduce phrase practice as a separate review surface for new KeyPhrases

## Parent

[PRD](../PRD.md)

## What to build

Create the first end-to-end proactive review path that no longer passes through `MistakePattern`.

When a new `Lesson` produces `KeyPhrase`-seeded practice, the system should create a separate proactive review aggregate instead of creating phrase-flavored `MistakePattern` rows. Learners should be able to access those new reviewable items through a dedicated phrase practice surface, with scheduling and prompt-generation behavior still functioning.

This surface should be intentionally minimal in PR 1. Reuse existing UI patterns wherever possible. The goal of this slice is to prove the new domain boundary end-to-end, not to introduce a large new page flow or redesign the review experience.

This slice should prove the new boundary for newly created practice items without yet changing repeated-weakness behavior or legacy migrated data.

## Acceptance criteria

- [ ] New `KeyPhrase`-seeded review creation writes to a proactive review aggregate that is not `MistakePattern`.
- [ ] Learners can access newly created proactive review items through a dedicated but minimal phrase practice surface.
- [ ] Scheduling and review prompt generation continue to work for those new proactive review items end-to-end.

## Blocked by

None - can start immediately

## Implementation brief

### Goal

Establish the first end-to-end proactive review path for new `KeyPhrase`-seeded practice without passing through `MistakePattern`.

### Non-goals

- Do not migrate legacy phrase-seeded rows in this issue.
- Do not change repeated-weakness behavior in this issue.
- Do not clean up compatibility semantics in this issue.
- Do not add new metrics in this issue.
- Do not turn this into a large UI redesign.

### Expected outcome

After this issue:

- newly generated `KeyPhrase` practice no longer seeds `MistakePattern`
- the system creates a proactive review item in the new aggregate
- learners can access it through a minimal phrase practice surface
- scheduling and prompt-generation behavior still works end-to-end for those new items

### Domain rules

- `MistakePattern` is reserved for repeated weakness derived from `UserError`
- proactive review is a separate aggregate and separate domain meaning
- scheduling mechanics may be reused, but mistake-memory semantics must not be reused by accident

### Recommended aggregate shape

Keep the new aggregate close enough to current phrase-seeded behavior to reduce migration risk later.

Preserve fields for:

- identity: `id`, `userId`, `keyPhraseId`, `conceptKey`, `senseKey`
- learner-facing target: `normalizedPhrase` (or temporary equivalent), `meaningVi`, `category`
- safe review content: `safeReviewPromptVi`, `reviewPromptEn`, `reviewPromptVi`, `reviewRubricVi`, `reviewCorrectAnswer`, `reviewAcceptableAnswers`, `reviewChoices`, `reviewType`
- scheduling and prompt state: `reviewPromptStatus`, `reviewPromptAttempts`, `reviewPromptError`, `reviewPromptLockedAt`, `reviewPromptLockedBy`, `intervalDays`, `easeFactor`, `repetitions`, `dueAt`, `lastReviewedAt`
- metadata: `source = phrase`, `isSensitive`, `createdAt`, `updatedAt`

Do not carry over mistake-memory-only semantics such as:

- `errorType`
- `occurrenceCount`

`masteryState` is not required for this issue. If implementation temporarily needs it to preserve behavior, treat it as compatibility only rather than final domain truth.

### Recommended seam

The main seam should remain inside the domain service layer. Avoid introducing a loose utility path that bypasses the domain boundary.

The lesson-generation path should still collaborate through a domain service that creates proactive review items, rather than continuing to route `KeyPhrase` seeding through `MistakePattern` infrastructure.

### Minimal UI scope

The phrase practice surface should be minimal:

- a separate route or screen is enough
- reuse existing review UI patterns where practical
- it only needs to support loading due proactive items, rendering prompts, submitting answers, and showing basic feedback

Do not expand this issue into a broad new flow or redesign.

### Acceptance intent

This issue is only done if the following flow is demonstrably true end-to-end:

1. Create a new `Lesson` with `KeyPhrase`-seeded practice
2. The system creates proactive review items in the new aggregate
3. Those items appear in the phrase practice surface
4. The learner can submit review answers there
5. The `MistakePattern` review queue is not used for this path

### Main risks

- accidentally reusing `MistakePattern` semantics through repository or naming choices
- making the new aggregate too different from legacy phrase-seeded behavior, which would increase migration difficulty in PR1/03
- allowing the minimal surface to grow into an unrelated UI project

### What to verify

- newly created proactive items are not written into `mistake_patterns`
- the phrase practice surface reads from the new aggregate
- review scheduling and prompt generation still work
- repeated mistake review behavior remains unchanged

## Execution checklist

### Safe implementation order

- [ ] Add a dedicated proactive review domain contract and UI plain-object contract instead of reusing `MistakePatternPlain`.
- [ ] Add the new persistence shape for proactive review in the schema and generate the migration before deeper wiring changes.
- [ ] Implement the proactive review repository/adapter path for creating, loading due items, and updating review state.
- [ ] Rewire the memory domain service so `KeyPhrase` seeding goes through the new proactive review path rather than `MistakePattern`.
- [ ] Rewire lesson generation to seed proactive review items after analysis is saved.
- [ ] Add a minimal dedicated phrase practice route or screen that reads due proactive review items.
- [ ] Add a dedicated submit path for phrase practice if the existing mistake-review action contract is too `MistakePattern`-specific.
- [ ] Add or update tests at the domain, adapter, and route/component seams.
- [ ] Run full verification: lint, typecheck, test, and build.

### File-by-file guidance

- [ ] Update the lesson-generation wiring so post-analysis `KeyPhrase` seeding no longer calls the old `MistakePattern` phrase path.
- [ ] Update memory domain ports, engine wiring, and factories to expose a proactive review creation/read path.
- [ ] Update or extend the Drizzle repository layer with a dedicated proactive review persistence path.
- [ ] Add the new proactive review schema and migration.
- [ ] Add a phrase practice surface that reuses UI patterns where practical but does not inherit mistake-memory semantics.
- [ ] Avoid directly reusing `ReviewCard` / `ReviewSession` contracts if they require `errorType`, `occurrenceCount`, or other repeated-weakness semantics.

### Critical invariants

- [ ] New `KeyPhrase`-seeded practice must not write into `mistake_patterns`.
- [ ] The phrase practice surface must read from the new aggregate only.
- [ ] Mistake review behavior under `/review` must remain unchanged during this issue.
- [ ] The new aggregate should preserve enough shape similarity with legacy phrase-seeded behavior to keep PR1/03 migration straightforward.
