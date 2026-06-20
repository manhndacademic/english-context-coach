Status: ready-for-agent

# Remove compatibility read paths from review surfaces

## Parent

[PRD](../PRD.md)

## What to build

Remove transitional compatibility logic from learner-facing read paths now that proactive review and `MistakePattern` have already been split in PR 1.

Review, dashboard, and history surfaces should read from the correct steady-state domain source without fallback behavior that assumes all reviewable items are mistake memory. This slice finishes the read side of the boundary so the codebase no longer carries mixed-model assumptions in user-facing query composition.

## Acceptance criteria

- [ ] Review, dashboard, and history read paths no longer rely on compatibility fallbacks from the old mixed model.
- [ ] Mistake review reads only from `MistakePattern`, while phrase practice reads only from the proactive review aggregate.
- [ ] Existing learner-facing behavior remains stable after compatibility read paths are removed.

## Blocked by

None - can start immediately
