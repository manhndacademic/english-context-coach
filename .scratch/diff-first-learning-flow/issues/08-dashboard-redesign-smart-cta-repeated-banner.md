Status: ready-for-agent

## Parent

[Diff-first Learning Flow PRD](.scratch/diff-first-learning-flow/PRD.md)

## What to build

Redesign the dashboard layout and completion summary to create a cohesive post-lesson experience:

**Dashboard**:

- Top section: Review prompt showing due item count and estimated time ("Ôn tập: N items — X phút"). CTA button to start unified review.
- Middle section: Progressive paste form (from issue 02).
- Bottom section: Stats — corrections learned, repeated mistakes, mastered items.

**CompletionSummary**:

- Replace the current 3-button layout with a smart CTA: one primary action chosen by the app based on current state (due review items → "Ôn tập N corrections cũ (X phút)", no due items → "Quay về dashboard"). Secondary links available but de-emphasized.
- Show CorrectionItems summary for diff-mode lessons instead of generic score.
- Remove hardcoded weekly goal bar.

**RepeatedMistakeBanner**:

- When the diff engine extracts CorrectionItems that match existing MistakePattern conceptKeys, show a prominent banner before the Understand Phase: "⚠️ Lỗi quen thuộc — 'very like → really like' — lần thứ N".
- Inform the exercise generator to use harder exercises for matched CorrectionItems.

## Acceptance criteria

- [ ] Dashboard layout: review section on top, paste form in middle, stats at bottom
- [ ] Review section shows due count and estimated duration
- [ ] CompletionSummary shows one smart primary CTA based on app state
- [ ] CompletionSummary shows CorrectionItems summary for diff-mode lessons
- [ ] Hardcoded weekly goal bar is removed or replaced with real data
- [ ] RepeatedMistakeBanner appears when CorrectionItems match existing MistakePatterns
- [ ] Banner shows occurrence count ("lần thứ N")
- [ ] `bun run lint && bun run typecheck && bun run test && bun run build` all pass

## Blocked by

- `07-unified-review-session`
