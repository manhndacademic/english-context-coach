Status: ready-for-agent

## Parent

[Diff-first Learning Flow PRD](.scratch/diff-first-learning-flow/PRD.md)

## What to build

Modify the exercise generation pipeline so that when a lesson has CorrectionItems (diff mode), it generates exactly 3 scaffolded exercises per CorrectionItem instead of the standard exercise generation:

1. **Recognize** (e.g., `meaning_choice` or `trap_choice`): "Which is the natural form?" with the draft phrase and corrected phrase as options.
2. **Guided** (e.g., `cloze_phrase`): Fill-in-the-blank where the corrected phrase is blanked out in a sentence.
3. **Produce** (e.g., `phrase_production`): Write a complete sentence using the correct form, given a Vietnamese context prompt.

For CorrectionItems that match an existing MistakePattern (repeated mistake), skip the recognize step and generate only guided + produce exercises (harder exercises for known weaknesses).

The exercise generation should use existing exercise types from the `exercise_type` enum — no new types are needed. The AI prompt for exercise generation should receive CorrectionItems instead of KeyPhrases.

## Acceptance criteria

- [ ] Diff-mode lessons generate exactly 3 exercises per CorrectionItem (recognize → guided → produce)
- [ ] Exercise order within each CorrectionItem group is: recognition first, production last
- [ ] Exercises use existing exercise types (meaning_choice/trap_choice, cloze_phrase, phrase_production)
- [ ] Repeated-mistake CorrectionItems generate only 2 exercises (guided + produce, skipping recognize)
- [ ] Non-diff lessons continue to generate exercises as before (no regression)
- [ ] Unit tests verify exercise count and ordering for a lesson with N CorrectionItems
- [ ] `bun run lint && bun run typecheck && bun run test && bun run build` all pass

## Blocked by

- `03-hybrid-diff-engine`
