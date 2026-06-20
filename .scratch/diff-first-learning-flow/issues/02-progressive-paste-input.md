Status: ready-for-agent

## Parent

[Diff-first Learning Flow PRD](.scratch/diff-first-learning-flow/PRD.md)

## What to build

Redesign the `SourceTextForm` component as a 2-step progressive paste flow. Step 1: the learner pastes their DraftText into the existing text editor. Step 2: after pasting, the form expands to show a prompt "Bạn có bản đã sửa?" with a second text editor for the SourceText (corrected version). If the learner provides both texts, the form submits both to `createSourceTextAction`. If only one text is provided, the form submits as before (understand mode).

Remove the coaching mode dropdown — mode is auto-detected based on whether one or two texts are provided.

Update `createSourceTextAction` and its Zod schema to accept optional `draftContent`. Pass it through to `LessonGenerationEngine.queue()`.

## Acceptance criteria

- [ ] SourceTextForm shows a single text input initially
- [ ] After pasting text, a second input appears with "Bạn có bản đã sửa?" prompt
- [ ] The second input is optional — submitting with one text still works (understand mode)
- [ ] Coaching mode dropdown is removed
- [ ] `createSourceTextAction` schema accepts optional `draftContent`
- [ ] Submitting with both texts creates a Lesson with linked DraftText record
- [ ] Submitting with one text creates a Lesson without DraftText (backward compatible)
- [ ] `bun run lint && bun run typecheck && bun run test && bun run build` all pass

## Blocked by

- `01-prefactor-widen-queue-for-draft-text`
