# Add sensitive memory branch

Status: done

## Goal

Prevent sensitive learner data from entering long-term `MistakePattern` memory.

## Scope

- Evaluate candidate memory with `TextProcessor.shouldScrubMistakePattern`.
- If sensitive, save `Attempt` and `UserError`.
- Do not create `MistakePattern`.
- Do not mark the error as repeated.
- Do not return `reviewPromptJob`.

## Acceptance criteria

- Tests cover sensitive KeyPhrase-derived memory.
- Tests cover sensitive fallback memory.
- Tests assert no `MistakePattern` is created.
- Tests assert no review prompt job is returned.

## Manual test

Run:

```bash
bun run test src/domain/memory
```
