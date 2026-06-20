Status: ready-for-agent

# PRD: MistakePattern Boundary Cleanup and Domain Naming Tightening

## Problem Statement

After splitting proactive review from `MistakePattern`, the codebase will still carry transitional compatibility paths, mixed terminology, and old assumptions that every reviewable item is mistake memory. If those leftovers remain, the domain boundary becomes fragile again:

- maintainers may accidentally route phrase practice back through mistake-memory concepts
- queries may retain special cases for legacy mixed behavior
- naming may continue to imply that proactive review is a kind of `MistakePattern`
- future work on `LessonFocus`, `Concept`, and `Sense` will be built on top of transitional logic rather than a stable model

The second PR needs to finish the cleanup so the boundary established in PR 1 becomes the new steady state.

## Solution

Remove compatibility paths introduced for rollout, tighten naming around mistake memory versus proactive review, and leave the codebase in a stable state where `MistakePattern` has exactly one meaning.

This PRD covers the code and documentation cleanup required after the migration has already landed safely.

## User Stories

1. As a developer, I want `MistakePattern` to have one unambiguous meaning everywhere, so that future changes do not reintroduce semantic drift.
2. As a developer, I want proactive review code to use its own domain terms consistently, so that naming reflects actual behavior.
3. As a developer, I want temporary compatibility branches removed, so that maintenance cost stays low.
4. As a developer, I want queries and repositories to stop carrying legacy mixed-model assumptions, so that new work starts from a clean boundary.
5. As a developer, I want review services to read from the correct domain source without special-case fallbacks, so that the architecture remains easy to reason about.
6. As a developer, I want history and dashboard logic to rely on explicit domain distinctions, so that analytics remain correct as features evolve.
7. As a developer, I want phrase practice and mistake review to stay clearly separated in test fixtures and helper code, so that tests encode the right model.
8. As a developer, I want compatibility naming like phrase-based pseudo-error semantics removed, so that future implementers are not misled.
9. As a product owner, I want the glossary and ADRs to match the implemented model, so that future planning starts from correct language.
10. As a product owner, I want the system's core terms to reinforce the product moat around personal error memory, so that the domain language supports the strategy.
11. As a learner, I want the system to keep behaving consistently after the cleanup, so that internal refactors do not change my review experience.
12. As a learner, I want phrase practice and mistake review to remain separate and understandable, so that the app keeps its clarity over time.
13. As a maintainer, I want the review domain prepared for later `LessonFocus` work, so that the next refactor does not have to dig through transition code first.
14. As a maintainer, I want the cleanup PR to be narrow and deliberate, so that it can verify no residual mixed semantics remain.
15. As a future refactorer, I want a stable boundary around mistake memory, so that adding explicit `Concept`, `Sense`, and `LearningTarget` objects is straightforward.

## Implementation Decisions

### Remove transitional compatibility

Any temporary read/write paths retained only for rollout safety in PR 1 must be removed. The final steady state should have direct ownership boundaries instead of fallback logic.

### Tighten domain naming

Naming across services, repositories, engines, and tests must reflect the actual model:

- `MistakePattern` means repeated weakness from `UserError`
- proactive review uses its own aggregate term
- no placeholder error semantics remain for proactive review

### Query cleanup

Review, dashboard, and history query code must no longer assume that all reviewable items come from one store or one aggregate. Query composition should become explicit and stable.

### Documentation alignment

`CONTEXT.md` and the relevant ADR documentation should be updated to reflect the decided boundary:

- `MistakePattern` is error-memory only
- proactive review is separate
- separate learner-facing surfaces are intentional

The cleanup should also remove language that suggests proactive review is a subtype of mistake memory.

### Preserve behavior

The cleanup PR should not introduce fresh product behavior changes beyond removal of transitional code. It is intended to harden the domain model, not expand scope.

### Keep future seams open

This cleanup should leave the review domain ready for:

- first-class `LessonFocus` review targeting
- explicit `LearningTarget`
- explicit `Concept` and `Sense`

without requiring future work to first unwind compatibility code.

## Testing Decisions

### What makes a good test here

A good test proves that the final model still behaves correctly after compatibility code is removed:

- mistake review still comes from repeated weakness only
- phrase practice still comes from proactive review only
- no residual mixed semantics survive in history, review, or dashboard behavior

Bad tests assert that a helper function was deleted or that an internal compatibility branch no longer exists. The test surface should remain external and behavioral.

### Modules to test

- review surface query composition
- dashboard and history aggregations
- memory domain engine or service entry points affected by naming cleanup
- documentation-facing invariants where existing tests already exercise them

### Prior art

Reuse and tighten the tests added in PR 1. Where existing tests rely on compatibility fixtures, replace them with fixtures that model the final steady state.

### Manual verification

- verify mistake review still shows only repeated weakness
- verify phrase practice still shows only proactive review items
- verify dashboard and history remain correct after compatibility code removal
- verify no route or UI component depends on transitional mixed-model queries

## Out of Scope

- making `LessonFocus` first-class in review
- introducing `LearningTarget`
- introducing explicit `Concept` or `Sense` objects
- changing `MistakePattern` identity to `Concept + Sense + ErrorType`
- `SourceMeaning` value object work
- review scheduling redesign
- broader UI redesign beyond what is required by the final boundary

## Further Notes

This PRD assumes PR 1 has already landed and migrated legacy phrase-seeded data. If that migration has not shipped, this PRD should not start.

The value of this PR is not new product breadth. Its value is removing ambiguity so later domain work builds on a steady model rather than a transitional one.
