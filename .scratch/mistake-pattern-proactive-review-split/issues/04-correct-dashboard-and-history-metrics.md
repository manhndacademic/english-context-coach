Status: ready-for-agent

# Correct dashboard and history metrics to separate practice from mistake memory

## Parent

[PRD](../PRD.md)

## What to build

Update learner-facing dashboard and history behavior so repeated-mistake metrics only describe `MistakePattern`, while proactive phrase practice is counted and presented separately.

After runtime behavior and legacy data are separated, correct the query and aggregation layer so that repeated mistakes, mastered repeated mistakes, review counts, and related history summaries stop mixing phrase practice with personal error memory.

For PR 1, this issue should focus on semantic correctness of existing repeated-mistake metrics. It should remove proactive phrase practice from those metrics, but it does not need to introduce brand-new phrase-practice metrics unless an existing learner-facing surface cannot function without them.

This slice finishes PR 1 by making the learner-visible reporting layer match the restored domain boundary.

## Acceptance criteria

- [ ] Dashboard repeated-mistake metrics count only `MistakePattern`-based repeated weakness.
- [ ] History no longer mixes proactive phrase practice with mistake memory summaries.
- [ ] PR 1 does not add new phrase-practice metrics unless they are strictly required for an existing learner-facing surface to function.
- [ ] Learners can still access both mistake review and phrase practice after the query and metric split.

## Blocked by

- [02-keep-mistake-review-exclusive-to-repeated-weakness.md](./02-keep-mistake-review-exclusive-to-repeated-weakness.md)
- [03-migrate-legacy-phrase-seeded-review-into-phrase-practice.md](./03-migrate-legacy-phrase-seeded-review-into-phrase-practice.md)
