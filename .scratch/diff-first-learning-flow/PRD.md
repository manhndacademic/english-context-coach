Status: ready-for-agent

# Diff-first Learning Flow Redesign

## Problem Statement

The app's primary user writes English for work (emails, Jira tickets, Slack messages, documents), asks external AI to correct it, sends the corrected version, and then immediately forgets every correction. After months of this pattern, the same mistakes recur — "very like" instead of "really like", "push back" misused — because nothing from the correction process sticks in long-term memory.

The app was built to solve this, but over many iterations it accumulated fragmented features (ErrorRepairSession, PhrasePractice, ReviewNudge, LessonPhases, 6 inputModes) that each work independently but don't form a cohesive learning flow. The user must manually navigate between `/review`, `/phrase-practice`, and `/lessons`, deciding "what should I do next?" instead of being guided. The UI feels inconsistent — each feature uses its own visual patterns.

The result: the core learning loop (paste → understand → practice → remember → review → improve) exists in pieces but doesn't feel like one unified experience.

## Solution

Redesign the learning flow around the user's actual workflow: **paste their draft alongside the AI-corrected version**, and learn from the differences. The app computes a diff, extracts CorrectionItems (individual corrections), explains each one in Vietnamese, and generates scaffolded exercises (recognize → guided → produce) per correction. Review evolves from context replay (early) to new-context flashcards (later). MistakePattern and PhrasePractice reviews merge into a single unified session. The dashboard prioritizes review over new input. The entire UI adopts a Clean & Minimal design system.

## User Stories

1. As a learner, I want to paste my original English draft and then paste the AI-corrected version, so that the app can identify exactly what I got wrong.
2. As a learner, I want the app to auto-detect whether I've provided one text or two, so that I don't have to manually select a "mode" from a dropdown.
3. As a learner, I want to see an inline diff view highlighting each correction (red for my draft, green for the corrected version), so that I can visually scan what changed.
4. As a learner, I want each correction to include a Vietnamese explanation of why the change was made, so that I understand the reasoning, not just the result.
5. As a learner, I want to see literal translation traps when relevant (e.g., "very like" literally means "rất thích" but English doesn't say "very like"), so that I learn to avoid word-by-word translation.
6. As a learner, I want exercises that start easy (recognize the correct form) and progress to hard (produce a sentence using the correct form), so that my brain encodes the correction deeply through scaffolded practice.
7. As a learner, I want 3 exercises per correction (multiple choice → fill-in-blank → free production), so that each correction gets enough practice without being tedious.
8. As a learner, I want to retry a failed exercise once immediately after seeing feedback, so that I can correct my understanding while the feedback is fresh.
9. As a learner, I want to skip the retry and move on, with the failed item automatically scheduled for review, so that I'm not blocked during a busy workday.
10. As a learner, I want the completion summary to show one smart CTA chosen by the app (e.g., "Review 5 old corrections — 3 min"), so that I don't have to decide what to do next.
11. As a learner, I want the dashboard to show due review items at the top before the paste input, so that I'm nudged to review old corrections before learning new ones.
12. As a learner, I want a single unified review session that mixes MistakePatterns and PhrasePractices, so that I don't have to visit two separate pages.
13. As a learner, I want recent review items (≤3 days) to replay the original correction context ("You wrote X, it was corrected to Y — what was the correction?"), so that I strengthen the specific memory trace.
14. As a learner, I want older review items (7+ days) to present a new context as a flashcard ("Translate this sentence"), so that I can transfer the learning to new situations.
15. As a learner, I want the app to show a prominent banner when a correction matches a previous MistakePattern ("This is the 3rd time you've been corrected on 'very like'"), so that I'm aware of my recurring weaknesses.
16. As a learner, I want exercises for repeated mistakes to be harder (production instead of recognition), so that the app pushes me harder on my known weak spots.
17. As a learner, I want the app to work when I paste only one text (no corrected version), falling back to the understand-and-practice mode, so that I can still use the app to understand emails or documents from others.
18. As a learner, I want a Clean & Minimal UI (Inter font, neutral + indigo palette, generous whitespace), so that the app feels professional in a work context and doesn't distract from the content.
19. As a learner, I want dark mode support, so that I can use the app comfortably during evening work sessions.
20. As a learner, I want the app to estimate review session duration ("5 items — 3 min"), so that I can decide whether to review during a short break.
21. As a learner, I want old lessons (created before this redesign) to continue working in understand mode, so that my learning history isn't broken.

## Implementation Decisions

### Domain Model (CONTEXT.md)

- **DraftText** added: the learner's own writing before correction. Compared against SourceText to produce CorrectionItems.
- **CorrectionItem** added: a single difference between DraftText and SourceText. The primary learning unit in diff mode. Each generates a scaffolded exercise group.
- **SourceText** updated: in diff mode, SourceText is the corrected version (the "right" version to learn from).
- **ErrorRepairSession** deprecated: replaced by in-place quick retry on each ExerciseCard.
- Recorded in ADR-0020.

### Input Mode Consolidation

- Six inputModes collapse to two: **diff mode** (primary, when DraftText is provided) and **understand mode** (secondary, single text).
- Four specialized modes removed: `fix_and_understand`, `naturalize_english`, `mixed_language_support`, `developer_error_explanation`.
- Auto-detection based on whether user provides one or two texts. No mode dropdown needed.
- Only the project creator uses the app currently (experimental phase), so no deprecation path is needed.

### Diff Engine (Hybrid)

- Step 1: Deterministic text diff algorithm (word-level, e.g., `diff-match-patch`) finds raw differences between DraftText and SourceText.
- Step 2: Raw diffs are sent to AI for classification (error type), Vietnamese explanation, literal trap detection, and example generation.
- Step 3: Output is a list of CorrectionItems with structured metadata.
- This avoids sending full text to AI when only a few words changed, reducing latency and token cost.
- The diff engine plugs into the existing `GenerationEngine` port as a new generation strategy.

### Scaffolded Exercise Generation

- Each CorrectionItem produces exactly 3 exercises in fixed order:
  1. **Recognize** (e.g., `meaning_choice` or `trap_choice`): "Which is the natural form?"
  2. **Guided** (e.g., `cloze_phrase`): "Fill in the blank: I \_\_\_ this idea"
  3. **Produce** (e.g., `phrase_production`): "Rewrite this sentence naturally: I very like working with this team"
- Repeated-mistake CorrectionItems skip the recognize step and start at guided or produce level.
- Exercise generation uses existing exercise types from the `exercise_type` enum — no new types needed.

### Quick Retry (replaces ErrorRepairSession)

- When a learner answers incorrectly, the ExerciseCard shows feedback + "Thử lại 1 lần" and "Đi tiếp →" buttons.
- If retry succeeds: marked as corrected, move to next exercise.
- If retry fails or user skips: the item enters the review schedule via the existing MistakePattern/PhrasePractice pipeline.
- The ErrorRepairSession component and its end-of-lesson blocking behavior are removed.

### Unified Review

- A single `/review` route serves both MistakePattern and PhrasePractice items.
- Items are merged into one list, with MistakePatterns prioritized (higher ROI for retention).
- The `/phrase-practice` route redirects to `/review`.
- Review mode is determined by item age:
  - ≤3 days since creation: **context replay** — shows original DraftText, hides correction, asks learner to reproduce.
  - 7+ days: **flashcard** — new context prompt, tests transfer. Uses existing privacy-safe review prompts.
- This requires storing a reference to the original DraftText on MistakePattern/PhrasePractice records.

### Smart Completion CTA

- CompletionSummary shows one primary CTA chosen by the app based on current state:
  - Due review items exist → "Ôn tập N corrections cũ (X phút)"
  - No due items → "Quay về dashboard"
- Secondary links available but de-emphasized.
- Hardcoded weekly goal bar replaced with real data or removed.

### Dashboard Layout

- Top: Review section with due count and estimated time. CTA to start unified review.
- Middle: Progressive paste form (DraftText → optional SourceText).
- Bottom: Stats (corrections learned, repeated mistakes, mastered items).

### Schema Changes

- New `draft_texts` table: `id`, `userId`, `sourceTextId` (FK to source_texts), `content`, `createdAt`.
- New `correction_items` table: `id`, `lessonId` (FK to lessons), `draftPhrase`, `correctedPhrase`, `explanationVi`, `literalTrapVi`, `exampleEn`, `exampleVi`, `category`, `errorType`, `orderIndex`, `createdAt`.
- Existing lessons without a DraftText continue to work in understand mode — no data migration needed.

### Design System

- Color palette: neutral base (slate/zinc) + indigo accent.
- Typography: Inter (Google Fonts).
- Diff colors: `#FEE2E2` (red-50) for draft, `#DCFCE7` (green-50) for corrected.
- Cards: light border, no heavy shadows, `rounded-lg`.
- Generous whitespace, consistent spacing scale.
- Dark mode via CSS custom properties.
- Design tokens defined in a central CSS file applied across all new and existing components.

### Vertical Slice Strategy

Implementation is organized into 3 vertical slices, each independently usable:

1. **Slice 1** (core diff flow): Schema + DraftText input + diff engine + DiffLessonLayout + scaffolded exercises + quick retry + smart CompletionSummary + design tokens for new components.
2. **Slice 2** (unified review & dashboard): Merge review tracks + context replay mode + dashboard layout redesign + repeated mistake banner.
3. **Slice 3** (design polish & cleanup): Apply design tokens to all existing components + dark mode + remove deprecated inputModes + remove ErrorRepairSession + clean up dead view components.

## Testing Decisions

A good test for this feature exercises the **external behavior** at the highest seam possible — verifying that the right CorrectionItems, exercises, and review items are produced from given inputs, without testing internal diff algorithms or AI prompt formatting.

### Primary Test Seam: `LessonGenerationEngine`

- **Diff flow integration**: Given a DraftText + SourceText pair, verify that `queue()` creates a DraftText record, routes to the diff pipeline, and produces CorrectionItems with the expected structure.
- **Scaffolded exercise output**: Verify that the generation pipeline produces exactly 3 exercises per CorrectionItem in the correct order (recognize → guided → produce).
- **Understand mode fallback**: Given a single text (no DraftText), verify the existing analysis pipeline is used unchanged.

### Secondary Test Seam: `LearnerMemoryEngine`

- **Quick retry**: Verify that `submitAttempt()` with a retry flag correctly marks the attempt and doesn't trigger ErrorRepairSession logic.
- **Review scheduling on failure**: Verify that a failed retry creates/updates the MistakePattern and sets `dueAt` for context replay.

### Tertiary Test Seam: Review Query Layer

- **Unified review loading**: Verify that the review query returns both MistakePattern and PhrasePractice items, sorted with MistakePattern first.
- **Review mode selection**: Verify context replay is used for items ≤3 days old, flashcard for 7+ days.

### Prior Art

- Existing test patterns in `src/domain/lesson/engine.test.ts` (22KB) for lesson generation pipeline.
- Existing test patterns in `src/domain/memory/engine.test.ts` (41KB) for attempt submission and MistakePattern lifecycle.
- Existing test patterns in `src/domain/memory/mistake-pattern.test.ts` and `phrase-practice.test.ts` for SRS scheduling.

## Out of Scope

- **Browser extension** for capturing corrections from ChatGPT/Grammarly directly (future consideration).
- **Mobile native app** — web-only for now.
- **Migrating old lessons** to diff format — old lessons continue working in understand mode.
- **Social/collaborative features** — leaderboard, sharing, team learning.
- **Payment/subscription** — experimental phase, single user.
- **Advanced gamification** — streaks and badges are sufficient; no XP systems, levels, or rewards.
- **RAG or graph memory** — the SM-2 spaced repetition system is sufficient for now.
- **Notification/reminder system** — no push notifications or email reminders for review. Dashboard nudge is sufficient.
- **AI-powered correction** (app correcting the draft itself) — the user prefers their existing external AI tools for correction.

## Further Notes

- The project is in experimental phase with a single user (the creator). This allows aggressive changes without backward compatibility concerns.
- The diff-first approach is a fundamental shift in the app's mental model: from "understand any English text" to "learn from your own corrections." The understand mode is preserved as secondary for when the user receives English text from others.
- The evolving review strategy (context replay → flashcard) is grounded in encoding specificity (Tulving, 1973) and desirable difficulty (Bjork, 1994) research. Early reviews benefit from matching the original learning context; later reviews benefit from testing transfer to new contexts.
- All 18 design decisions from the grilling session are documented in the implementation plan artifact and in ADR-0020.
