# English Context Coach

English Context Coach helps Vietnamese learners understand English source material in context and practice repeated misunderstandings.

## Language

**SourceText**:
The original English material pasted by a learner.
_Avoid_: Text, InputText, Article

**Lesson**:
A generated learning version created from one SourceText.
_Avoid_: Analysis, article lesson

**GenerationProgress**:
The learner-visible progress of turning a SourceText into a Lesson, including intermediate generation milestones before the Lesson is complete.
_Avoid_: Polling status, job status, loading state

**GenerationMilestone**:
A recorded learner-visible checkpoint reached while producing a Lesson.
_Avoid_: Percentage, spinner message, internal log

**GenerationThought**:
A learner-visible summary of what the model is considering while producing a Lesson.
_Avoid_: Raw chain-of-thought, hidden reasoning trace, debug log

**KeyPhrase**:
A word, phrase, or term whose contextual sense is important for understanding the SourceText.
_Avoid_: Vocabulary item, word

**Exercise**:
A practice prompt fixed to a specific Lesson.
_Avoid_: Quiz question, task

**Attempt**:
A learner's submitted answer to an Exercise.
_Avoid_: Response, submission

**UserError**:
A concrete misunderstanding detected from an Attempt.
_Avoid_: Mistake, failure

**MistakePattern**:
A repeated learner weakness aggregated from UserErrors and scheduled for review.
_Avoid_: ReviewItem, MemoryItem

**User**:
The learner identity in the system.
_Avoid_: Account, login

**Account**:
A login method linked to a User, such as Google OAuth or password login.
_Avoid_: User, profile
