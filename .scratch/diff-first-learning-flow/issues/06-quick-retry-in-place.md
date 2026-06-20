Status: ready-for-agent

## Parent

[Diff-first Learning Flow PRD](.scratch/diff-first-learning-flow/PRD.md)

## What to build

Replace the ErrorRepairSession with in-place quick retry on each ExerciseCard. When a learner answers incorrectly:

1. Show the grading feedback (as currently).
2. Below the feedback, show two buttons: "Thử lại 1 lần" and "Đi tiếp →".
3. If the learner retries and answers correctly: mark the exercise as corrected, proceed to the next exercise.
4. If the learner retries and answers incorrectly again, OR clicks "Đi tiếp": the item is scheduled for review via the existing MistakePattern/PhrasePractice pipeline, and the learner proceeds to the next exercise.

Remove the ErrorRepairSession component and its end-of-lesson blocking behavior from the lesson page. The completion summary should no longer show an ErrorRepairSession prompt.

This slice works independently of the diff flow — it applies to ALL exercises (diff and understand mode).

## Acceptance criteria

- [ ] ExerciseCard shows "Thử lại 1 lần" and "Đi tiếp →" buttons after incorrect answer
- [ ] Successful retry marks exercise as corrected and moves to next
- [ ] Failed retry or skip moves to next exercise (item enters review schedule)
- [ ] Only 1 retry attempt is allowed per exercise
- [ ] ErrorRepairSession component is removed from the lesson page
- [ ] Completion summary no longer references ErrorRepairSession
- [ ] Old understand-mode lessons also use quick retry (not just diff mode)
- [ ] `bun run lint && bun run typecheck && bun run test && bun run build` all pass

## Blocked by

None - can start immediately
