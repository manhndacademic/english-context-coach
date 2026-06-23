# UX & AI Reliability Refactor

Status: ready-for-agent

---

## Problem Statement

Vietnamese learners using English Context Coach encounter three compounding problems that erode trust in the product:

1. **AI analysis frequently fails with JSON format errors.** The root cause: the Gemini provider uses an outdated structured output API (`responseMimeType` + `responseSchema` with a custom 191-line `zodToGeminiSchema` converter), and the `isGemini3` workaround disables `responseSchema` entirely for the 3 most-used models in the pool (`gemini-3.1-flash-lite`, `gemini-3-flash-preview`, `gemini-3.5-flash`). These models fall back to free-form JSON generation, relying on a 350-line defensive JSON repair pipeline that frequently fails or produces garbled output (e.g., raw ProseMirror JSON rendering in the Word Diff view). The official Gemini SDK now supports `responseFormat.text` with `zod-to-json-schema`, which guarantees valid JSON structure and preserves Zod `.describe()` metadata.

2. **The UI gives poor feedback when errors occur.** All 7 user-facing error paths use `window.alert()` — a jarring browser-native popup with no styling, no dismiss control, and no action context. There is no toast or notification system. Users see a raw error string in a grey box and have no idea what to do next. Meanwhile, a P0 design token bug (`hover:bg-surface-active` is used in 3 major interactive components but was never defined) means hover states on exercise cards, grading feedback, and review cards fail silently — the app feels unresponsive without visible cause.

3. **The learning flow has unnecessary friction.** On the Lesson page, the exercise panel is visible on the right column but locked behind a blur overlay. The unlock CTA ("Đã hiểu ngữ cảnh, bắt đầu thực hành 🚀") is buried at the bottom of the left column — the learner must scroll past SourceText, MeaningPanel, and SentenceBreakdown to find it. The overlay has a secondary "Mở khóa ngay" button, but it's `text-xs` and nearly invisible. On the Dashboard, lesson card titles are truncated to a single line with `text-overflow: ellipsis`, making it hard to distinguish lessons. The primary layout component `DiffLessonLayout` is a 749-line monolith handling 6+ concerns, making maintenance and bug fixes costly. The codebase has no formal design system document — 20+ places copy-paste `bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md`, 12+ places duplicate badge styling, and 9+ places repeat the same hover shadow as an arbitrary Tailwind value.

---

## Solution

Refactor along three axes — AI reliability, notification UX, and design system — in 6 phases designed so each commit leaves the codebase in a working state:

1. **Migrate to the official Gemini Structured Output API** (`responseFormat.text` + `zod-to-json-schema`), replacing the custom `zodToGeminiSchema` converter and eliminating the `isGemini3` workaround. Set `gemini-3.1-flash-lite` as the primary default model. Simplify the JSON repair pipeline to a fast-path-with-fallback pattern.

2. **Build a design system foundation** — fix the P0 `--surface-active` token, create canonical UI primitives (`Badge`, `SectionCard`, `StatCard`, `PageLayout`, `PageHeader`), document the design system, and migrate app pages to use the new primitives.

3. **Add a toast notification system** (Sonner) and replace all `window.alert()` calls with contextual toast messages.

4. **Fix the Lesson page unlock flow** — remove the scroll-dependent unlock button, upgrade the overlay CTA to a prominent primary button, and fix the Word Diff raw JSON rendering bug.

5. **Improve Dashboard lesson card UX** — multi-line titles, better card sizing — and migrate dashboard and other pages to the new primitives.

6. **Decompose the DiffLessonLayout monolith** into focused sub-components (`CorrectionCard`, `ToneAnalysisBanner`, `ContextOverrideBadges`, `LessonPhaseGuard`) and replace raw Tailwind colors with semantic design tokens across lesson components.

---

## User Stories

1. As a learner, I want my pasted text to be analyzed successfully on the first attempt, so that I don't have to retry or wonder if the app is broken.
2. As a learner, I want to see a clear, styled notification when an AI error occurs, so that I understand what happened and what I can do about it.
3. As a learner, I want to see formatted text differences in the Word Diff view, so that I can visually compare my draft with the corrected version without seeing raw JSON.
4. As a learner, I want to unlock exercises with a single visible click on the exercise panel, so that I don't have to scroll past all the explanation content to start practicing.
5. As a learner, I want exercise cards to give visual hover feedback when I interact with them, so that the app feels responsive and alive.
6. As a learner, I want to see my lesson titles in the dashboard without harsh truncation, so that I can distinguish between different lessons I've created.
7. As a learner, I want clipboard paste errors to appear as brief, non-blocking notifications rather than browser alert popups, so that my flow is not interrupted.
8. As a learner, I want the app to give me a polished confirmation dialog (not `window.confirm()`) when I change the CommunicationContext of a lesson, so that the experience feels professional.
9. As a learner returning to a lesson with previous attempts, I want exercises to auto-unlock, so that I can resume practicing immediately.
10. As a learner, I want correction cards to be visually consistent with the rest of the app's design tokens (not raw hex colors), so that dark mode and theme changes work reliably.
11. As an admin, I want AI calls to timeout after 60 seconds rather than hanging indefinitely, so that stuck jobs are detected and re-queued.
12. As a developer, I want a documented design system with Do/Don't rules, so that I build new pages consistently without guessing at spacing, colors, or component choices.
13. As a developer, I want the DiffLessonLayout to be decomposed into focused sub-components, so that I can fix bugs or add features without navigating a 749-line file.
14. As a developer, I want the Lesson phase-lock logic to be a shared component, so that changes to the understand→practice flow are applied consistently across Standard and Diff layouts.
15. As a developer, I want the JSON repair pipeline to have a fast path that skips unnecessary processing when structured output delivers valid JSON, so that AI response handling is faster and simpler.
16. As a developer, I want a canonical `SectionCard` component, so that I don't have to copy-paste the same 6-class card styling across 20+ locations.
17. As a developer, I want all badge labels to use a `Badge` component with CVA variants, so that visual consistency is enforced by the component API rather than manual class duplication.

---

## Implementation Decisions

### AI Provider Migration

- **Migrate from `responseMimeType` + `responseSchema` to `responseFormat.text`** — the new official Gemini API format. This eliminates the `isGemini3` workaround that was disabling structured output for the 3 most-used models.
- **Replace `zodToGeminiSchema()` (custom 191-line converter) with `zod-to-json-schema` npm package** — a well-maintained library that produces standard JSON Schema, preserves `.describe()` metadata and Zod constraints (min/max, regex, etc.), and handles all Zod types including `ZodRecord`, `ZodTuple`, `ZodDate`.
- **Set `gemini-3.1-flash-lite` as the primary default model** (first in rotation pool). Free tier: 1M input tokens, 65K output tokens, 15 requests/minute, 500 requests/day.
- **Remove Gemma models from the default rotation pool** — user decision to focus on Gemini models. Gemma does support `responseSchema` via the Google AI API, but the backward-compatibility code (thinking level mapping, model set) is preserved for users who configure Gemma via environment variables.
- **Add AbortController timeout** (60s default, configurable via `GEMINI_TIMEOUT_MS`) to prevent hung API connections from blocking workers indefinitely. Timeout errors are classified as transient and trigger re-queue.
- **Simplify `JsonParserService` to fast-path-with-fallback**: with structured output active, `JSON.parse()` should succeed directly. The existing repair pipeline (`extractJson`, `repairJson`) becomes a fallback path. Value-level sanitization (`sanitizeValue`, `coerceJsonForSchema`) is kept because it handles content-level cleanup regardless of JSON validity.

### Design System Foundation

- **Fix P0 bug**: define `--surface-active` token (light: `rgba(5,150,105,0.06)`, dark: `rgba(16,185,129,0.08)`) — currently referenced by 3 interactive components but never defined.
- **Add `.hover-shadow-accent` CSS utility** — replaces 9+ occurrences of `hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)]`.
- **Extend `Button` with `asChild` prop** via `@radix-ui/react-slot` (already in deps) — enables `<Button asChild><Link>...</Link></Button>` pattern, eliminating 15+ hand-rolled button link styles.
- **Create new UI primitives**: `Badge` (CVA: default/accent/success/warning/danger), `SectionCard` (compound: Header/Body/Footer, `shadow-md`), `StatCard` (value variants), `PageLayout` (wraps AppHeader + main container), `PageHeader` (h1 + back link + actions).
- **`SectionCard` coexists with existing `Card`** — different shadow levels (`shadow-md` vs `shadow-sm`), different padding patterns, different use cases.
- **Document the design system** in `docs/design-system.md` — color tokens, typography scale, spacing guidance, component inventory, Do/Don't rules.

### Toast Notification System

- **Sonner** — lightweight (~3KB gzipped), no context provider needed, theme-aware (respects `data-theme` attribute), positioned bottom-right.
- **Replace all 7 `window.alert()` calls** with typed toasts (`toast.error()`, `toast.warning()`).
- **Replace `window.confirm()`** in DiffLessonLayout context override with the existing `ConfirmDialog` component.

### Lesson Page UX

- **Remove the scroll-dependent unlock button** at the bottom of the left column.
- **Upgrade the lock overlay CTA** from `text-xs px-4 py-2` to a full-size primary `Button` with pulse animation and descriptive microcopy.
- **Fix Word Diff raw JSON rendering** — the `draftContent` is arriving as ProseMirror JSON instead of plain text in certain code paths.
- **Extract `LessonPhaseGuard` as a shared component** — eliminates ~40 lines of duplicated phase logic between `StandardLessonLayout` and `DiffLessonLayout`.

### Dashboard UX

- **Lesson card titles**: `truncate` (1 line) → `line-clamp-2` (2 lines), font size bump on desktop, `title` attribute for tooltip.
- **Page migrations**: Dashboard, History, Review, Settings pages migrated to new primitives (`PageLayout`, `SectionCard`, `StatCard`, `Badge`). Landing page partially migrated (Badge + Button only).

### DiffLessonLayout Decomposition

- **Extract `CorrectionCard`** — accept/reject toggle, inline editing, cultural notes, validation.
- **Extract `ToneAnalysisBanner`** — standalone, no side effects.
- **Extract `ContextOverrideBadges`** — clickable DocumentType/Formality chips with confirmation dialog.
- **Replace raw Tailwind colors** (`text-red-600`, `dark:text-[#ff8585]`, `bg-green-100`) with semantic tokens (`text-danger`, `dark:text-danger`, `bg-success-light`) and inline button styles with the `Button` component.

### Schema Changes

None. No database schema modifications.

### API Contract Changes

- `LLMProvider` port interface unchanged — all AI changes are internal to the `GeminiLLMProvider` adapter.
- `ApiRotationPool` default model lists change (Gemma removed).
- New component exports: `Badge`, `SectionCard`, `StatCard`, `PageLayout`, `PageHeader`, `CorrectionCard`, `ToneAnalysisBanner`, `ContextOverrideBadges`, `LessonPhaseGuard`.

---

## Testing Decisions

### What makes a good test

Tests should verify external behavior — user actions producing visible results — not internal implementation details or CSS class names. AI layer tests mock LLM responses and verify schema validation and error handling paths. Component tests render, interact, and assert visible output.

### Modules to test

- **`GeminiLLMProvider`** (unit) — verify `responseFormat.text` config is constructed correctly for all model types, verify timeout behavior. Prior art: `gemini-provider.test.ts`.
- **`ApiRotationPool`** (unit) — verify Gemma removed from defaults, verify model rotation still works. Prior art: `api-rotation-pool.test.ts`.
- **`JsonParserService`** (unit) — verify fast path succeeds with valid JSON, verify fallback path activates for malformed input. Prior art: `json-parser-service.test.ts`.
- **`Badge`, `SectionCard`, `StatCard`** (component) — verify variant rendering, ARIA roles, text content. Prior art: `ui/dialog.test.tsx`.
- **`CorrectionCard`, `LessonPhaseGuard`** (component) — verify accept/reject behavior, phase transition. Prior art: `DiffLessonLayout.test.tsx`.
- **`DiffLessonLayout`** (component) — update existing tests after decomposition. Prior art: `DiffLessonLayout.test.tsx`.
- **`lesson-card`** (component) — new tests for multi-line title rendering. No prior art — use `ui/dialog.test.tsx` pattern.

---

## Out of Scope

- MUI or any full component library migration — evaluated and rejected (cost/benefit).
- Mobile-first responsive redesign — current breakpoints adequate.
- `@google/genai` SDK version upgrade — evaluate after structured output migration confirms compatibility.
- Exponential backoff for transient retries — tracked in `.scratch/codebase-robustness-backlog/`.
- Stale job reclamation heartbeat worker — tracked in `.scratch/codebase-robustness-backlog/`.
- Domain seam restoration (circular imports, side effects in repos) — tracked in `.scratch/domain-seam-restoration/`.
- `zodToJsonSchema` advanced tuning (custom schema transformations) — follow up only if structured output quality is insufficient.
- Storybook, new animation libraries, or new testing frameworks.
- Browser extension, payment, social features.

---

## Further Notes

### Seam for testing

The primary seam is **`LLMProvider.generateJson<T>()`** — the port interface between the domain and the AI adapter. All AI reliability changes (structured output migration, timeout, JSON parser simplification) are internal to the `GeminiLLMProvider` adapter behind this seam. The port interface itself does not change, so all existing domain-level tests remain valid. Component-level seams are the individual TSX component boundaries — each extracted component (`CorrectionCard`, `LessonPhaseGuard`, etc.) becomes its own testable unit.

### Execution order

Phases have dependency ordering: Phase 1 (AI) is independent and highest impact. Phase 2 (Design System foundation) is independent with zero regression risk (only adds new files until migration commits). Phase 3 (Toast) depends on Phase 2.1 (globals fix). Phase 4 (Lesson UX) depends on Phase 3 (toast available). Phase 5 (Dashboard) depends on Phase 2 (primitives ready). Phase 6 (Decomposition) depends on Phase 3+4 (toast + overlay already refactored).

### Overlap with existing backlog

- `.scratch/codebase-robustness-backlog/` items 1 (AI Rotation) and 2 (JSON Parser) are partially addressed by Phase 1.
- `.scratch/design-system-foundation/` is fully subsumed by Phase 2 — that issue can be marked `wontfix` (merged here).

### Enforcement

After completion, add to `AGENTS.md`: "All new pages must use `<PageLayout>`. All section cards must use `<SectionCard>`. All label badges must use `<Badge>`. No raw Tailwind color classes — use semantic tokens only."
