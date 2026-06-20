Status: ready-for-agent

## Parent

[Diff-first Learning Flow PRD](.scratch/diff-first-learning-flow/PRD.md)

## What to build

Create a `DiffLessonLayout` component that replaces `StandardLessonLayout` when a lesson has a DraftText. The layout shows:

1. **Inline diff view**: The full text with corrections highlighted — red background (`#FEE2E2`) for removed DraftText words, green background (`#DCFCE7`) for added SourceText words.
2. **CorrectionItem cards**: Below or alongside the diff, each CorrectionItem is rendered as a card showing: draft phrase → corrected phrase (with arrow), explanationVi, literal trap (if present), and a similar example.
3. **Understand Phase**: The exercise panel remains locked (as in current LessonPhase behavior) until the learner clicks "Đã hiểu, bắt đầu luyện tập".

The lesson page should auto-select `DiffLessonLayout` when the `LessonAggregate` includes a `draftText` and `correctionItems`, otherwise fall back to `StandardLessonLayout`.

Apply the initial design tokens: Inter font, neutral + indigo palette, generous whitespace, consistent card styling.

## Acceptance criteria

- [ ] `DiffLessonLayout` component exists and renders inline diff with red/green highlights
- [ ] CorrectionItem cards show all fields: draft phrase, corrected phrase, explanationVi, literalTrapVi, example
- [ ] Lesson page auto-selects DiffLessonLayout when DraftText is present
- [ ] Lesson page falls back to StandardLessonLayout when DraftText is absent
- [ ] Understand Phase with locked exercises works in diff layout
- [ ] Design tokens applied: Inter font, neutral + indigo palette, consistent spacing
- [ ] `bun run lint && bun run typecheck && bun run test && bun run build` all pass

## Blocked by

- `03-hybrid-diff-engine`
