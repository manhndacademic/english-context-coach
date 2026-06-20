# Sequential Lesson Phases and Personalized Flow

## Context

Originally, the system presented all components of a generated lesson simultaneously (source text, translations, key phrases, and exercises). Learners frequently skipped reading the context and key phrases, jumping straight to the exercises. This resulted in preventable errors and missed learning opportunities regarding translation traps.

Furthermore, lesson exercises were generated statically without taking the learner's active weaknesses (`MistakePattern`s) into account. Finally, the 15-30 second wait time during lesson generation lacked engagement, and the post-lesson summary did not enforce immediate correction of mistakes.

## Decision

We optimize the learning flow from the dashboard to the lesson completion through a series of cohesive UX and behavioral design improvements:

1. **Dashboard & Clipboard Activation**:
   - Add a one-click "Paste from Clipboard" button to reduce input friction.
   - Introduce **ContextTemplates** (predefined work-message, academic, and technical snippets) to let new users quickly try the app.
   - Integrate a quick single-card micro-practice directly inside the `ReviewNudge` on the dashboard.

2. **Active Waiting (`TranslationTrapTrivia`)**:
   - During `GenerationProgress`, display a micro-trivia card detailing a common word-by-word translation trap. Learners can interact with it to learn something new while waiting.

3. **Sequential Lesson Phases (`LessonPhase`)**:
   - Restructure the lesson view into two sequential phases:
     - **Understand Phase**: The `ExercisePanel` is locked. The UI highlights key phrases and directs the learner's attention to the contextual translation and translation-trap explanations.
     - **Practice Phase**: Unlocked only when the learner clicks a prominent `"Đã hiểu ngữ cảnh, bắt đầu luyện tập"` CTA.
   - Hide the detailed `SentenceBreakdownPanel` behind an expandable accordion to keep the initial screen clean.

4. **Weakness-Targeted Exercise Generation**:
   - Query the user's active `MistakePattern` concepts during exercise generation. If the source text contains terms belonging to those concepts, prioritize active and trap-avoiding exercise types (e.g., `phrase_production`, `trap_choice`).

5. **Immediate Repair & Mastery Progress (`ErrorRepairSession`)**:
   - Introduce an **ErrorRepairSession** at the end of the lesson, forcing learners to immediately retry any failed exercises.
   - Display a visual mastery progress update on the completion card to show how their mistakes affected their weekly progress.

## Consequences

- **Efficacy**: Forcing context reading before testing builds a stronger mental model of context-first translation.
- **Engagement**: Trivia games keep the user active during generation, reducing drop-off.
- **Retention**: Immediate error repair reinforces correct patterns before the incorrect traces fade.
- **Personalization**: Personal error memory directly shapes new content, fulfilling the north-star loop.
