Status: ready-for-agent

# Remove compatibility write paths and tighten domain naming

## Parent

[PRD](../PRD.md)

## What to build

Remove transitional write-side compatibility and tighten naming so the steady-state domain model is explicit everywhere.

After PR 1, any code that still routes proactive review through mistake-memory concepts, or still uses phrase-based pseudo-error semantics, must be removed. Service, repository, engine, and test vocabulary should reflect the final model: `MistakePattern` means repeated weakness from `UserError`, and proactive review uses its own aggregate language.

This issue is also where temporary compatibility semantics intentionally preserved in PR 1 should be cleaned up. In particular, if PR 1 carries over `masteryState` or similarly named fields only to preserve behavior during migration, PR 2 must either rename, replace, or re-interpret them so the proactive review aggregate no longer inherits mistake-memory meaning by accident.

This slice completes the write side of the cleanup and makes future refactors less likely to reintroduce semantic drift.

## Acceptance criteria

- [ ] No active write path routes proactive review creation or updates through `MistakePattern` semantics.
- [ ] Transitional naming that implies proactive review is a kind of mistake memory is removed from code and test fixtures.
- [ ] Any temporary PR 1 compatibility semantics preserved only for migration safety are removed, renamed, or replaced so the proactive review aggregate no longer carries mistake-memory meaning.
- [ ] The final write-side behavior remains correct end-to-end for both mistake review and phrase practice.

## Blocked by

- [01-remove-compatibility-read-paths-from-review-surfaces.md](./01-remove-compatibility-read-paths-from-review-surfaces.md)
