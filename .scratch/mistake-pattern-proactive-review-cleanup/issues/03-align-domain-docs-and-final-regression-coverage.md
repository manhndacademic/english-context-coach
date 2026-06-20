Status: ready-for-agent

# Align domain docs and final regression coverage

## Parent

[PRD](../PRD.md)

## What to build

Bring the project documentation and regression coverage into line with the final steady-state review model.

Update the glossary and ADR documentation so they describe the implemented boundary accurately: `MistakePattern` is error-memory only, proactive review is separate, and separate learner-facing surfaces are intentional. At the same time, tighten regression coverage so the final model is protected against accidental reintroduction of mixed semantics.

This slice completes PR 2 by making the codebase, tests, and domain language point at the same model.

## Acceptance criteria

- [ ] `CONTEXT.md` and the relevant ADR documentation reflect the final boundary between mistake memory and proactive review.
- [ ] Regression coverage demonstrates that mistake review and phrase practice remain separate in steady-state behavior.
- [ ] No remaining compatibility assumptions are required to understand or maintain the review domain.

## Blocked by

- [02-remove-compatibility-write-paths-and-tighten-domain-naming.md](./02-remove-compatibility-write-paths-and-tighten-domain-naming.md)
