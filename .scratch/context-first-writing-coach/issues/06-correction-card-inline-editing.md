Status: ready-for-agent

## Parent

[PRD: Context-first Writing Coach](./../PRD.md)

## What to build

Add inline editing capability to each correction card so the learner can fix the AI's suggested corrected phrase when it's wrong or over-corrected. The edited phrase persists to the database and becomes the basis for exercise generation.

Specifically:

- **Edit button (✏️)** on each correction card, next to the corrected phrase display.
- **Inline edit mode**: clicking the edit button replaces the corrected phrase text with an input field pre-filled with the current `correctedPhrase`. Two buttons appear: "Lưu" (save) and "Hủy" (cancel).
- **Save action**: calls a new Server Action `updateCorrectionPhraseAction(correctionItemId, newPhrase)` that updates the `correctedPhrase` column on the `correction_items` table. After saving, the page refreshes (router refresh) to reflect the change in the Word Diff view and the correction card.
- **Cancel action**: reverts the input to the original value and exits edit mode.
- **Validation**: the new phrase must be non-empty and different from the draft phrase (can't "correct" to the same text as the original).
- The Word Diff at the top of the page should reflect the edit after refresh (since it's computed from DraftText vs SourceText/corrections).

## Acceptance criteria

- [ ] Each correction card has an edit button (✏️) next to the corrected phrase
- [ ] Clicking edit replaces the corrected phrase with an editable input field
- [ ] "Lưu" button saves the new phrase via `updateCorrectionPhraseAction`
- [ ] "Hủy" button cancels the edit and reverts to the original phrase
- [ ] Empty or whitespace-only phrases are rejected with inline validation feedback
- [ ] After saving, the correction card shows the updated phrase
- [ ] After saving and page refresh, the Word Diff view reflects the edited phrase
- [ ] `updateCorrectionPhraseAction` validates that the user owns the lesson
- [ ] `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` all pass

## Blocked by

- [04: culturalNoteVi + tone banner + accept/reject](./04-cultural-note-tone-banner-accept-reject.md)
