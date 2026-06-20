Status: done

# Migrate legacy phrase-seeded review into phrase practice

## Parent

[PRD](../PRD.md)

## What to build

Migrate existing legacy phrase-seeded review data currently stored as `MistakePattern` into the new proactive review aggregate.

The migration strategy should be copy-then-cutover, not direct move-in-place. Legacy phrase-seeded rows should first be copied into the new proactive review aggregate, then verified through the phrase practice surface, and only then cut over so they stop behaving like mistake memory.

The migration must preserve learner progress where meaningful, including due timing and prompt-generation state, and it must leave migrated items accessible from the phrase practice surface instead of behaving like mistake memory.

For PR 1, preserve behavior first. Keep scheduling and prompt-related fields wherever they encode learner progress, but do not carry over fields whose meaning depends on repeated weakness. A temporary compatibility carryover of `masteryState` is allowed in PR 1 if needed to preserve review behavior, but it should be treated as transitional compatibility rather than final domain truth.

This slice completes the old-data transition so the system no longer relies on mixed semantics for previously created phrase practice.

## Acceptance criteria

- [ ] Existing legacy phrase-seeded review data is migrated into the proactive review aggregate.
- [ ] The migration uses a copy-then-cutover strategy, with validation through the phrase practice surface before final cutover.
- [ ] Preserved learner progress includes due/scheduling state and review prompt state where meaningful.
- [ ] The migration preserves behavior-critical scheduling/prompt fields while excluding fields whose meaning depends on repeated mistake memory.
- [ ] Migrated phrase-seeded items appear in phrase practice and stop behaving like `MistakePattern`-based mistake memory.

## Blocked by

- [01-introduce-phrase-practice-surface-for-new-keyphrases.md](./01-introduce-phrase-practice-surface-for-new-keyphrases.md)
