# Attempt Memory Transition Refactor

Status: done

## Product impact

This refactor strengthens the core learning loop:

```txt
Submit answer
-> Grade answer
-> Explain mistake in Vietnamese
-> Save structured UserError
-> Detect repeated mistake
-> Create or update MistakePattern
-> Help user review it later
```

The target module is `AttemptMemoryTransition`: a deeper Memory module that owns the transition from a learner's `Attempt` into durable learning memory.

## Guiding questions

1. Context understanding: yes
2. Literal translation traps: yes
3. Wrong answer -> memory: yes
4. Better review tomorrow: yes
5. Visible progress: yes

## Current problem

`DefaultLearnerMemoryEngine.submitAttempt` currently knows too much:

- Grading result interpretation
- Confidence gate for saving errors
- `KeyPhrase` vs `LessonFocus` target selection
- fallback `Concept` derivation
- `UserError` creation
- repeated `MistakePattern` detection
- `MistakePattern` creation/update/reactivation
- review prompt job dispatch decision

This makes the module shallow: the caller-facing interface is small, but the orchestration implementation is also the only place where core memory rules are understandable. Tests must know many internal details to cover the product moat.

## Target shape

Introduce an `AttemptMemoryTransition` module inside `src/domain/memory/`.

It should hide the rules for:

- deciding whether a wrong `Attempt` should become a `UserError`
- resolving the authoritative `Concept`
- deciding whether a `MistakePattern` should be created, updated, or reactivated
- deciding whether a review prompt job should be dispatched
- preventing sensitive data from entering long-term `MistakePattern` memory

`DefaultLearnerMemoryEngine` should remain the orchestrator:

- find the `Exercise`
- call the `GradingEngine` outside the transaction
- skip persistence on system grading failure
- run `AttemptMemoryTransition` inside the transaction
- dispatch review prompt jobs after the transaction
- map the domain-rich result to `AttemptFormResult`

## Decisions

- `Concept` truth comes from `KeyPhrase` or `LessonFocus`; AI grading cannot override it.
- AI grading may provide score, correctness, `errorType`, confidence, `explanationVi`, and supporting `targetItem`.
- If an `Exercise` has no `KeyPhrase` or `LessonFocus`, fallback `Concept` comes from `exercise.correctAnswer ?? exercise.promptEn ?? exercise.promptVi`; `grade.error.targetItem` is secondary.
- Grading happens outside the DB transaction.
- Persistence transition happens inside the DB transaction.
- If AI grading fails as a system failure, do not save an `Attempt`.
- If `grade.error.shouldSave = false`, save the `Attempt` but do not create `UserError` or `MistakePattern`.
- Use a Memory domain constant for the confidence gate, initially `MIN_USER_ERROR_CONFIDENCE = 70`.
- `AttemptMemoryTransition` resolves `KeyPhrase` and `LessonFocus` itself.
- `AttemptMemoryTransition` returns a domain-rich result; `DefaultLearnerMemoryEngine` maps it to `AttemptFormResult`.
- Review prompt jobs are returned as output, then dispatched by the caller after the transaction.
- `MistakePattern` aggregate owns occurrence and reactivation rules.
- Repeated `MistakePattern` matching uses `userId + conceptKey + errorType`.
- If a mastered `MistakePattern` is missed again, reactivate it.
- Reactivated `MistakePattern.dueAt` is immediate.
- Keep current behavior where `UserError.normalizedPhrase` stores `conceptPhrase`; track a later rename to avoid misleading maintainers.
- If memory candidate is sensitive, save `UserError` but do not create `MistakePattern`.
- Sensitive decision uses `TextProcessor.shouldScrubMistakePattern` over candidate memory.
- Sensitive `UserError` without a `MistakePattern` is not considered repeated.
- Do not add `AttemptMemoryTransition` to `CONTEXT.md`; it is a module name, not learner-facing domain language.

## Proposed interface sketch

This is illustrative, not final:

```ts
type AttemptMemoryTransitionInput = {
  userId: string;
  lessonId: string;
  exercise: Exercise;
  answer: string;
  grade: GradingResult;
};

type AttemptMemoryTransitionResult = {
  attemptSaved: true;
  grade: GradingResult;
  userErrorCreated: boolean;
  mistakePatternStatus: "new" | "repeated" | "none";
  reviewPromptJob?: { patternId: string };
};
```

## Task breakdown

Implementation tasks live in `issues/`.

Recommended order:

1. `issues/01-add-transition-contract.md`
2. `issues/02-move-concept-resolution.md`
3. `issues/03-move-persistence-transition.md`
4. `issues/04-add-sensitive-memory-branch.md`
5. `issues/05-wire-engine-to-transition.md`
6. `issues/06-tighten-tests-and-cleanup.md`

## Verification

Before completion:

```bash
bun run lint
bun run test
bun run build
```

## Known risks

- `DrizzleMistakePatternRepository.upsertMistakePattern` currently increments `occurrenceCount` in SQL on conflict. Moving ownership to the aggregate must avoid double increments.
- Sensitive branch changes behavior: sensitive errors should no longer create long-term `MistakePattern` memory.
- `UserError.normalizedPhrase` is semantically misleading because it stores `conceptPhrase`.
- Tests should distinguish learner mistakes from system grading failures so progress is not polluted.
