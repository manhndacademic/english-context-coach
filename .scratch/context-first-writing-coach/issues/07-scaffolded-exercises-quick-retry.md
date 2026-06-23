Status: completed

## Parent

[PRD: Context-first Writing Coach](./../PRD.md)

## What to build

Wire up scaffolded exercise generation from CorrectionItems produced by the writing coach engine, and add quick retry UX on the ExerciseCard when the learner answers incorrectly.

The `DiffExercisesPrompt` already generates scaffolded exercises from CorrectionItems (3 per correction: recognize → guided → produce, with repeated mistakes skipping recognize). This slice ensures the writing coach output (which produces CorrectionItems in the same format as the diff engine) flows through the same exercise generation pipeline, and adds the quick retry interaction.

Specifically:

- **Verify exercise generation works end-to-end for write mode**: a lesson created via write mode (Slice 02) should produce CorrectionItems, and when exercise generation is triggered, the `DiffExercisesPrompt` should produce scaffolded exercises from those CorrectionItems. This may require ensuring that `inputMode === "write"` is handled the same as `inputMode === "diff"` for exercise generation routing.
- **Quick retry on ExerciseCard**: when a learner answers incorrectly, show feedback alongside two buttons: "Thử lại 1 lần" and "Đi tiếp →". If the learner retries and succeeds, mark the exercise as corrected and continue. If retry fails or the learner skips, the item enters the review schedule via the existing MistakePattern pipeline.
- **Smart CompletionSummary CTA**: after completing all exercises, the CompletionSummary shows one primary CTA based on current state: if due review items exist → "Ôn tập N corrections cũ (X phút)"; otherwise → "Quay về dashboard".

## Acceptance criteria

- [ ] Write mode lessons produce CorrectionItems that generate scaffolded exercises (3 per correction in correct order)
- [ ] Repeated-mistake CorrectionItems produce 2 exercises (skip recognize step)
- [ ] Exercise generation routing handles `inputMode === "write"` the same as `inputMode === "diff"` for exercise prompt selection
- [ ] ExerciseCard shows "Thử lại 1 lần" and "Đi tiếp →" buttons after an incorrect answer
- [ ] Successful retry marks the exercise as corrected
- [ ] Failed retry or skip schedules the item for review via MistakePattern pipeline
- [ ] CompletionSummary shows smart CTA based on due review count
- [ ] `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` all pass

## Blocked by

- [02: Writing Coach Engine](./02-writing-coach-engine.md)
