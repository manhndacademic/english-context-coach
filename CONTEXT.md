# English Context Coach

English Context Coach helps Vietnamese learners understand English source material in context and practice repeated misunderstandings.

## Language

**SourceText**:
The original English material pasted by a learner. SourceText remains the learner's original material even when the Lesson presents it in a more readable form. In diff mode, SourceText is the corrected version (the "right" version to learn from), because it is the material the Lesson is built on. Use natural learner-facing copy such as "source text" or "English source text" instead of the PascalCase term in UI text.
_Avoid_: Text, InputText, Article

**DraftText**:
The learner's own English (or Vietnamese) writing before it was corrected by AI or another person. DraftText is compared against SourceText to produce CorrectionItems. A Lesson may or may not have a DraftText — when absent, the Lesson operates in understand mode.
_Avoid_: Original text, raw text, user input

**CorrectionItem**:
A single difference between a DraftText and its SourceText, representing one correction the learner needs to internalize. Each CorrectionItem generates a scaffolded exercise group (recognize → guided → produce). CorrectionItems are the primary learning unit in diff mode.
_Avoid_: Diff, change, fix, correction

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
A distinct word, phrase, or term from the SourceText whose contextual sense is important for understanding it. A KeyPhrase should distinguish its reusable general meaning from its specific meaning in the SourceText and include up to 3 context-relevant examples (English sentences and Vietnamese translations) to help the learner visualize its usage.
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
A practice prompt fixed to a specific Lesson. Exercises test KeyPhrases or LessonFocuses using various smart types (multiple choice on meaning, fill-in-the-blank, natural translation, focus questions, literal trap choice, active phrase production, dialogue completion, register shift, or translation trap detection). Each Exercise has a primary target for judging the learner's answer.
_Avoid_: Quiz question, task

**ExercisePractice**:
An aggregate in the `memory` package that groups an `Exercise` with its associated practice history (attempts, user errors, and mistake patterns). It simplifies UI rendering and statistics calculations by encapsulating the relationship between content and learner performance.
_Avoid_: PracticeDetail, ExerciseAttemptGroup

**Attempt**:
A learner's submitted answer to an Exercise. An Attempt may be partially correct when it captures some meaning but misses the Exercise's primary target.
_Avoid_: Response, submission

**UserError**:
A valid learner misunderstanding detected from an Attempt when the learner misses the Exercise's primary target. A UserError can come from missing a KeyPhrase or a LessonFocus, and has one primary misunderstanding type.
_Avoid_: Mistake, failure

**MistakePattern**:
A repeated learner weakness aggregated from UserErrors and scheduled for review. A MistakePattern represents the underlying concept-level misunderstanding (not tied to a specific KeyPhrase) and has a MasteryState.
_Avoid_: ReviewItem, MemoryItem

**PhrasePractice**:
A proactive vocabulary review scheduled for a KeyPhrase that the user studied in a Lesson, designed to reinforce learning before mistakes are made. A PhrasePractice has a MasteryState.
_Avoid_: VocabularyReview, ProactiveReview, MistakePattern

**Concept**:
A generalized language understanding unit (e.g., a phrasal verb root or grammatical pattern) that groups related KeyPhrases or LessonFocuses. MistakePatterns aggregate UserErrors by Concept rather than exact phrase spelling, helping the learner review related mistakes together.
_Avoid_: Lemma, root phrase, category key

**MasteryState**:
The learner-facing learning state of a MistakePattern or PhrasePractice, either active or mastered. A mastered item is kept in history and can become active again when a new UserError or failed review attempt shows the learner still has that weakness.
_Avoid_: Status, due

**Due MistakePattern**:
An active MistakePattern whose review time has arrived and is ready to be practiced. Due is review eligibility, not a MasteryState.
_Avoid_: ReviewItem, due state

**ReviewAttempt**:
A learner's app-graded answer to a privacy-safe review prompt for a MistakePattern. A ReviewAttempt updates review progress for old misunderstandings, not Lesson-grounded UserError evidence.
_Avoid_: Attempt, self-check

**PhrasePracticeAttempt**:
A learner's app-graded answer to a review prompt for a PhrasePractice. A PhrasePracticeAttempt updates the review progress for the proactive phrase.
_Avoid_: ReviewAttempt, Attempt

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

**ContextTemplate**:
A predefined English source text sample (with a title, text category, and coaching mode) shown on the dashboard to allow learners to generate a demonstration Lesson instantly.
_Avoid_: Sample text, example article

**TranslationTrapTrivia**:
A quick, single-question game about a common word-by-word translation trap, displayed to the learner during GenerationProgress to keep them engaged while their Lesson is being created.
_Avoid_: Loading quiz, trivia question

**ErrorRepairSession** _(deprecated)_:
Formerly an immediate practice loop at the end of a Lesson. Replaced by in-place quick retry on each ExerciseCard: when a learner answers incorrectly, they can retry once immediately, and unresolved items enter the review schedule. This removes the end-of-lesson blocking session.
_Avoid_: Retry quiz, error correction

**LessonPhase**:
One of the two distinct learning states of a Lesson: the _Understand Phase_ (focusing on the SourceText meaning and KeyPhrases) and the _Practice Phase_ (focusing on completing Exercises).
_Avoid_: Tab, step

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
The mechanism that rotates across active SystemApiKeys and available AI models based on availability, health, and rate limits. When one key or model is rate-limited, the pool selects the next available combination so that learner requests are fulfilled without re-queuing.
_Avoid_: Key balancer, key switcher, ModelPool
