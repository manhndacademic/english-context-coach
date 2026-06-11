# English Context Coach

English Context Coach helps Vietnamese learners understand English source material in context and practice repeated misunderstandings.

## Language

**SourceText**:
The original English material pasted by a learner. Use natural learner-facing copy such as "source text" or "English source text" instead of the PascalCase term in UI text.
_Avoid_: Text, InputText, Article

**Lesson**:
A generated learning version created from one SourceText. A SourceText may have multiple Lesson versions, with the latest successful Lesson acting as the default learner surface. A complete Lesson includes SourceMeaning, distinct KeyPhrases when useful, one or more LessonFocuses, and enough Exercises to practice both phrase-level and whole-text understanding.
_Avoid_: Analysis, article lesson

**GenerationProgress**:
The learner-visible progress of turning a SourceText into a Lesson, expressed as application-controlled milestones before the Lesson is complete.
_Avoid_: Polling status, job status, loading state

**GenerationMilestone**:
A recorded learner-visible checkpoint reached while producing a Lesson.
_Avoid_: Percentage, spinner message, internal log

**KeyPhrase**:
A distinct word, phrase, or term from the SourceText whose contextual sense is important for understanding it. A KeyPhrase should distinguish its reusable general meaning from its specific meaning in the SourceText.
_Avoid_: Vocabulary item, word

**LessonFocus**:
A lesson-level concept that helps the learner understand the SourceText beyond individual KeyPhrases, such as tone, structure, purpose, or context. LessonFocuses can be primary Exercise targets when tone, structure, or purpose matters more than a single phrase.
_Avoid_: Topic, theme, skill

**SourceMeaning**:
The learner-facing Vietnamese explanation of what the SourceText means as a whole, including its natural translation, summary, and context. SourceMeaning should not include a full literal translation by default.
_Avoid_: Literal translation, raw translation

**Exercise**:
A practice prompt fixed to a specific Lesson. An Exercise may practice a KeyPhrase or a broader LessonFocus, and has a primary target for judging the learner's answer. A LessonFocus Exercise tests whole-text meaning, tone, structure, or purpose grounded in the SourceText.
_Avoid_: Quiz question, task

**Attempt**:
A learner's submitted answer to an Exercise. An Attempt may be partially correct when it captures some meaning but misses the Exercise's primary target.
_Avoid_: Response, submission

**UserError**:
A valid learner misunderstanding detected from an Attempt when the learner misses the Exercise's primary target. A UserError can come from missing a KeyPhrase or a LessonFocus, and has one primary misunderstanding type.
_Avoid_: Mistake, failure

**MistakeConcept**:
An underlying recurring contextual misunderstanding learned from one or more UserErrors. MistakeConcepts drive review scheduling and mastery, while phrase-specific details remain evidence.
_Avoid_: ReviewItem, MemoryItem, MistakePattern

**MistakePattern**:
A phrase-specific or focus-specific expression of a MistakeConcept, retained as evidence for why the concept exists.
_Avoid_: MistakeConcept, ReviewItem, MemoryItem

**MistakeEvidence**:
A source-scoped link showing that a UserError from a Lesson contributed to a MistakePattern and MistakeConcept.
_Avoid_: Heuristic ownership, source scan

**MasteryState**:
The learner-facing review state of a MistakeConcept, such as new, learning, reviewing, mastered, or relearning. A mastered MistakeConcept is kept in history and can become relearning when new graded evidence shows the learner still has that weakness.
_Avoid_: Status, schedule state

**ReviewExercise**:
A privacy-safe active-recall prompt generated from a MistakeConcept without replaying original SourceText sentences.
_Avoid_: Self-check, source replay

**ReviewAttempt**:
A learner's app-graded answer to a ReviewExercise for a MistakeConcept. A ReviewAttempt updates mastery only after grading succeeds.
_Avoid_: Attempt, self-check

**User**:
The learner identity in the system.
_Avoid_: Account, login

**Account**:
A login method linked to a User, such as Google OAuth or password login.
_Avoid_: User, profile
