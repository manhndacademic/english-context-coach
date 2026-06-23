# Decompose DiffLessonLayout and standardize design tokens

Status: done

## Parent

[PRD.md](../PRD.md)

## What to build

`DiffLessonLayout` is a 749-line monolith handling 6+ concerns. Decompose it into focused sub-components and standardize raw Tailwind colors to semantic design tokens across all lesson components.

1. **Extract `CorrectionCard`** — accept/reject toggle, inline editing, cultural notes, validation. Props: `item`, `isRejected`, `isEditing`, `onToggleReject`, `onStartEdit`, `onSaveEdit`, `onCancelEdit`.

2. **Extract `ToneAnalysisBanner`** — standalone tone analysis card rendering with no side effects.

3. **Extract `ContextOverrideBadges`** — clickable DocumentType + Formality chips with confirmation dialog logic.

4. **Extract shared `LessonPhaseGuard`** — used by both StandardLessonLayout and DiffLessonLayout. Encapsulates the lock overlay, phase state, and auto-unlock logic. Eliminates ~40 lines of duplicated code between layouts.

5. **Replace raw Tailwind colors** in all lesson components, exercise-card, and review-card: `text-red-600` → `text-danger`, `dark:text-[#ff8585]` → `dark:text-danger`, `bg-green-100` → `bg-success-light`, etc. Replace 9+ inline hover shadow strings with `.hover-shadow-accent`. Replace hand-rolled button styles with the `Button` component.

Decomposition must preserve all existing behavior — no functional changes. Verify by running existing DiffLessonLayout tests and visual inspection.

## Acceptance criteria

- [x] `CorrectionCard` extracted as standalone component with focused responsibility
- [x] `ToneAnalysisBanner` extracted as standalone component
- [x] `ContextOverrideBadges` extracted with encapsulated confirmation dialog
- [x] `LessonPhaseGuard` shared between Standard and Diff layouts
- [x] DiffLessonLayout reduced from ~749 lines to ≤400 lines
- [x] Zero raw Tailwind color classes in lesson components (all semantic tokens)
- [x] Zero inline hover shadow arbitrary values in lesson components
- [x] Hand-rolled button styles replaced with `Button` component
- [x] All existing DiffLessonLayout tests pass without functional changes
- [x] New unit tests for extracted components
- [x] `bun run test` passes
- [x] `bun run build` passes
- [x] Manual test: lesson page behavior is identical before and after decomposition

## Blocked by

- [03-toast-notification-system](03-toast-notification-system.md) — DiffLessonLayout toast calls must exist before extraction
- [04-lesson-unlock-flow-and-word-diff](04-lesson-unlock-flow-and-word-diff.md) — overlay redesign must be complete before extracting `LessonPhaseGuard`
