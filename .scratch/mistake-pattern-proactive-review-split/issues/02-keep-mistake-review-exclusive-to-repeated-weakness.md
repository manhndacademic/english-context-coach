Status: ready-for-agent

# Keep mistake review exclusive to repeated weakness

## Parent

[PRD](../PRD.md)

## What to build

Make the learner-facing mistake review surface mean exactly one thing: repeated weakness derived from `UserError`.

After the proactive phrase practice path exists, update the runtime behavior so that mistake review reads only from `MistakePattern`, while phrase-seeded practice no longer appears in that queue for newly created items. Repeated `Attempt` and `ReviewAttempt` flows must continue to create and update `MistakePattern` correctly.

This slice restores the core product promise that mistake review is evidence-backed memory rather than generic review content.

## Acceptance criteria

- [ ] The mistake review queue reads only `MistakePattern` items that represent repeated weakness.
- [ ] Newly created phrase-seeded practice items do not appear in the mistake review surface.
- [ ] Repeated-weakness creation and review behavior from `UserError` continues to work end-to-end without regression.

## Blocked by

- [01-introduce-phrase-practice-surface-for-new-keyphrases.md](./01-introduce-phrase-practice-surface-for-new-keyphrases.md)
