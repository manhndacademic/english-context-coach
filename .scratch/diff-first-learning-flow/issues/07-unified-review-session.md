Status: ready-for-agent

## Parent

[Diff-first Learning Flow PRD](.scratch/diff-first-learning-flow/PRD.md)

## What to build

Merge MistakePattern review and PhrasePractice review into a single unified review session at `/review`. The session loads both due MistakePatterns and due PhrasePractices, merges them into one list with MistakePatterns prioritized first, and presents them sequentially with a unified progress bar.

Introduce review mode selection based on item age:

- Items created ≤3 days ago: **context replay** — show the original DraftText phrase, hide the corrected phrase, ask the learner to type the correction. Compare their answer against the stored corrected phrase.
- Items created 7+ days ago: **flashcard** — use the existing privacy-safe review prompt with a new context.
- Items between 3-7 days: use context replay.

For context replay to work, MistakePattern and PhrasePractice records need a reference to the original DraftText content (the draft phrase that was corrected). Store this as a new field.

Redirect `/phrase-practice` to `/review`. Remove the standalone PhrasePracticeSession component (merge its logic into the unified ReviewSession).

## Acceptance criteria

- [ ] `/review` loads both due MistakePatterns and PhrasePractices in a single session
- [ ] MistakePatterns appear before PhrasePractices in the review order
- [ ] Unified progress bar shows total items (both types combined)
- [ ] Items ≤3 days old use context replay (show draft phrase, ask for correction)
- [ ] Items 7+ days old use flashcard with existing privacy-safe prompts
- [ ] `/phrase-practice` redirects to `/review`
- [ ] MistakePattern/PhrasePractice records store original draft phrase for context replay
- [ ] Existing review functionality (SM-2 scheduling, mastery state) continues to work
- [ ] `bun run lint && bun run typecheck && bun run test && bun run build` all pass

## Blocked by

- `06-quick-retry-in-place`
