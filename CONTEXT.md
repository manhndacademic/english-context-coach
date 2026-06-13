# English Context Coach

English Context Coach helps Vietnamese learners understand English source material in context and practice repeated misunderstandings.

## Language

**SourceText**:
The original English material pasted by a learner. SourceText remains the learner's original material even when the Lesson presents it in a more readable form. Use natural learner-facing copy such as "source text" or "English source text" instead of the PascalCase term in UI text.
_Avoid_: Text, InputText, Article

**Lesson**:
A generated learning version created from one SourceText. A SourceText may have multiple Lesson versions, with the latest successful Lesson acting as the default learner surface. A complete Lesson includes SourceMeaning, SentenceBreakdown when useful, distinct KeyPhrases when useful, one or more LessonFocuses, and enough Exercises to practice both phrase-level and whole-text understanding.
_Avoid_: Analysis, article lesson

**GenerationProgress**:
The learner-visible progress of turning a SourceText into a Lesson, including intermediate generation milestones before the Lesson is complete.
_Avoid_: Polling status, job status, loading state

**GenerationMilestone**:
A recorded learner-visible checkpoint reached while producing a Lesson.
_Avoid_: Percentage, spinner message, internal log

**GenerationThought**:
A learner-visible progress note about Lesson generation. GenerationThought must be filtered for learner-safe wording and should not expose raw reasoning, code, prompts, schemas, or implementation details.
_Avoid_: Raw chain-of-thought, hidden reasoning trace, debug log

**KeyPhrase**:
A distinct word, phrase, or term from the SourceText whose contextual sense is important for understanding it. A KeyPhrase should distinguish its reusable general meaning from its specific meaning in the SourceText and include a related example when that helps the learner apply the phrase.
_Avoid_: Vocabulary item, word

**SentenceBreakdown**:
A learner-facing explanation of how individual SourceText sentences work, including their natural meaning, important structure, and context when those details help the learner understand the SourceText beyond isolated KeyPhrases.
_Avoid_: Sentence parsing, grammar dump, line-by-line translation

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

**MistakePattern**:
A repeated learner weakness aggregated from UserErrors and scheduled for review. A MistakePattern represents the underlying misunderstanding concept, whether it came from KeyPhrase or LessonFocus practice, and has a MasteryState.
_Avoid_: ReviewItem, MemoryItem

**Concept**:
A generalized language understanding unit (e.g., a phrasal verb root or grammatical pattern) that groups related KeyPhrases or LessonFocuses. MistakePatterns aggregate UserErrors by Concept rather than exact phrase spelling, helping the learner review related mistakes together.
_Avoid_: Lemma, root phrase, category key

**MasteryState**:
The learner-facing review state of a MistakePattern, such as due, active, or mastered. A mastered MistakePattern is kept in history and can become active again when a new UserError or failed ReviewAttempt shows the learner still has that weakness.
_Avoid_: Status, schedule state

**ReviewAttempt**:
A learner's app-graded answer to a privacy-safe review prompt for a MistakePattern. A ReviewAttempt updates review progress for old misunderstandings, not Lesson-grounded UserError evidence.
_Avoid_: Attempt, self-check

**User**:
The learner identity in the system.
_Avoid_: Account, login

**Account**:
A login method linked to a User, such as Google OAuth or password login.
_Avoid_: User, profile

**LearningStreak**:
The number of consecutive days a learner has completed at least one Attempt or ReviewAttempt. A LearningStreak resets to zero when the learner misses a full calendar day.
_Avoid_: Streak, daily streak, login streak

**CompletionSummary**:
A learner-facing summary shown after the learner completes all Exercises in a Lesson, including new phrases learned, mistakes made, and next review date. CompletionSummary is distinct from a Lesson's SourceMeaning summary.
_Avoid_: LessonSummary, report, recap

**ReviewNudge**:
A dashboard prompt showing due MistakePatterns that encourages the learner to start reviewing before pasting new text.
_Avoid_: Reminder, notification, alert

**SystemApiKey**:
An AI provider API key managed by administrators and shared in a rotated pool.
_Avoid_: Global API key, system token

**UserApiKey**:
A personal AI provider API key supplied by a User in settings and used exclusively for their own requests.
_Avoid_: Custom API key, personal token

**ApiRotationPool**:
The mechanism that rotates and selects active SystemApiKeys based on availability, health, and rate limits.
_Avoid_: Key balancer, key switcher

