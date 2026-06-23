# Design System Foundation Refactor

Status: ready-for-agent

---

## Problem Statement

The codebase uses Tailwind CSS but lacks a consistent design system. As a result:

1. **`hover:bg-surface-active` is broken (P0 bug)**: This token is referenced in 3 large components (`exercise-card.tsx`, `grading-feedback.tsx`, `review-card.tsx`) but is **never defined** anywhere in `globals.css` or `@theme`. The hover state silently fails with no visual feedback.

2. **`Button` component is widely bypassed (P1)**: The `Button` component with CVA variants exists but 15+ places across the codebase hand-roll the primary button style as raw Tailwind strings — with at least **5 different effective heights** (`h-[38px]`, `h-10`, `min-h-11`, `h-11`, `min-h-10`) and varying shadow definitions. The string `hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)]` appears 9+ times as an arbitrary value.

3. **`SectionCard` pattern is copy-pasted 20+ times (P1)**: The class string `"bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md"` appears verbatim in `dashboard/page.tsx` (×4), `history/page.tsx`, `settings/page.tsx`, `lesson/StandardLessonLayout.tsx` (×2), and elsewhere. No `SectionCard` component exists — the existing `Card` uses `shadow-sm` instead of `shadow-md` so it is not used.

4. **Off-palette colors bypass the token system (P2)**: `text-emerald-600`, `text-orange-600`, and `bg-amber-50/text-amber-700` are used directly instead of `text-accent` and `text-warning`. `dark:text-[#ff8585]` and `dark:text-[#a7f3d0]` appear 10+ times instead of `dark:text-danger` and `dark:text-success`. `bg-[#fff5f4] border-[#f2b8b5]` is used instead of `bg-danger-light`.

5. **Badge/label pattern is repeated 12+ times (P2)**: `"inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-xs font-extrabold"` appears in at least 12 places with no `Badge` component to consolidate them.

6. **Layout max-width is inconsistent (P3)**: The landing page uses `max-w-[1200px]`, app pages use `max-w-[1100px]`, and the dashboard uses `max-w-275` (Tailwind numeric = 68.75rem ≈ 1100px but different syntax). `AppHeader` accepts `maxWidthClass` as a string prop — layout width is a decision made per-call rather than a single design token.

7. **Typography is arbitrary (P3)**: `h2` elements appear with `text-2xl`, `text-[28px]`, `text-lg`, and `text-xl`. The landing page uses `text-[32px] md:text-5xl lg:text-[56px]` instead of the Tailwind named scale. No typography scale document exists.

8. **Spacing tokens are defined but not adopted (P4)**: `--spacing-layout-gap` and `--spacing-card-padding` are defined in `globals.css` but most places still use raw `gap-4`, `gap-5`, and `gap-6`.

**Real-world consequence**: Upgrading the UI to a custom design system in the future would require touching 50+ locations instead of 5–6 primitive components.

---

## Solution

**Safe / primitives-first approach**: Build a new layer of primitive components without touching any existing files in the early commits. Pages are migrated to the new primitives only after the foundation is stable.

---

## Commits

### Commit 1 — Fix P0: Define `--surface-active` token in `globals.css`

Add `--surface-active` to both light and dark theme blocks in `globals.css` and register it in the `@theme {}` block:

- Light: `rgba(5, 150, 105, 0.06)` — a subtle emerald tint on surface
- Dark: `rgba(16, 185, 129, 0.08)`

This is a pure bugfix. Run `bun run build` to verify no Tailwind warnings remain. No component is changed.

---

### Commit 2 — Extend `globals.css` with a typography scale reference and hover shadow utility

Add a comment block to `globals.css` documenting the canonical typography scale:

```css
/* Typography scale reference
   xs   = 0.75rem  (12px) — labels, badges
   sm   = 0.875rem (14px) — body, descriptions
   base = 1rem     (16px) — default body
   lg   = 1.125rem (18px) — section subheadings
   xl   = 1.25rem  (20px) — card headings
   2xl  = 1.5rem   (24px) — page h2
   3xl  = 1.875rem (30px) — page h1 (mobile)
   4xl  = 2.25rem  (36px) — page h1 (desktop)
*/
```

Add a named utility class `.hover-shadow-accent` to replace the 9+ occurrences of `hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)]`:

```css
.hover-shadow-accent:hover {
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.15);
}
```

No components are changed.

---

### Commit 3 — Extend `Button` with `asChild` prop and bake in `hover-shadow-accent`

Modify `src/components/ui/button.tsx`:

- Add `asChild?: boolean` prop using `@radix-ui/react-slot` (already available in `node_modules` via existing Radix dependencies).
- When `asChild=true`, render `<Slot>` instead of `<button>`, enabling `<Button asChild><Link href="...">...</Link></Button>`.
- Add `hover-shadow-accent` to the `default` variant base classes.

This is a fully backward-compatible change — no existing callers are modified.

---

### Commit 4 — Add `Badge` component

Create `/src/components/ui/badge.tsx` using CVA.

Variants:

- `default`: `bg-surface-strong border border-border text-muted` — neutral label (replaces the 12+ repeated inline strings)
- `accent`: `bg-accent-light border border-accent/20 text-accent`
- `success`: `bg-success-light text-success`
- `warning`: `bg-warning-light text-warning`
- `danger`: `bg-danger-light text-danger`

Sizes: `sm` (default: `px-2.5 py-1 text-xs`), `md` (`px-3 py-1.5 text-sm`)

Shape: `rounded-full` by default.

Export `Badge` and `badgeVariants`. No existing callers are modified.

---

### Commit 5 — Add `SectionCard` compound component

Create `/src/components/ui/section-card.tsx`.

`SectionCard` is the canonical section container for all app pages:

- Base: `bg-surface border border-border rounded-lg shadow-md` (uses `shadow-md`, unlike the existing `Card` which uses `shadow-sm`)
- Default padding: `p-5 sm:p-8` (responsive)
- Default content gap: `grid gap-4`

Sub-components:

- `SectionCard.Header`: renders an `h2` with `text-xl font-bold text-text` + an icon slot + an optional description (`text-sm text-muted`)
- `SectionCard.Body`: `<div className="grid gap-4">`
- `SectionCard.Footer`: optional action row with `border-t border-border pt-4 flex items-center justify-between`

Accepts `className`, `gap`, and `padding` overrides. No existing pages are modified.

---

### Commit 6 — Add `StatCard` component

Create `/src/components/ui/stat-card.tsx`.

```tsx
<StatCard label="Lessons completed" value={lessonsCompleted} />
<StatCard label="Due for review" value={dueCount} valueVariant={dueCount > 0 ? "warning" : "default"} />
```

Props: `label`, `value`, `valueVariant?: "default" | "accent" | "success" | "warning" | "danger"`

Base style: `hover-lift bg-surface border border-border rounded-lg p-4 shadow-sm grid gap-1`

Replaces the 6 repeated stat divs in `history/page.tsx` and the similar pattern in `dashboard/dashboard-stats.tsx`. No existing pages are modified.

---

### Commit 7 — Add `PageLayout` and `PageHeader` components

Create `/src/components/ui/page-layout.tsx`:

- `PageContainer`: `<main className="max-w-275 mx-auto px-4 sm:px-6 pt-6 pb-10 flex flex-col gap-6">` — the single canonical container for all authenticated pages.
- `PageLayout`: wraps `<AppHeader>` + `<PageContainer>`, eliminating the copy-pasted `AppHeader` props across 5 pages.

```tsx
<PageLayout user={user}>{children}</PageLayout>
```

The `user` prop accepts `{ email, role, image }`. `isAdmin` is derived from `role === "admin"` internally.

Create `/src/components/ui/page-header.tsx`:

```tsx
<PageHeader
  title="Learning History"
  icon={<History />}
  description="Review your progress..."
  backHref="/dashboard"
  backLabel="Back to Dashboard"
  actions={<Button>...</Button>}
/>
```

The `h1` always uses `text-2xl sm:text-3xl font-bold font-serif`. The back link always uses `text-xs font-bold text-accent`. No existing pages are modified.

---

### Commit 8 — Write `/docs/design-system.md`

Document the design system for developers and future agents:

- **Color tokens**: Full reference table — token name, light/dark values, intended use case.
- **Typography scale**: Size name → pixel value → when to use (app h1, app h2, body, label...).
- **Spacing scale**: When to use `gap-layout-gap` vs `gap-4` vs `gap-dense-gap`.
- **Component inventory**: All UI primitives with a description of when to use each.
- **Do / Don't rules**: "DO use `<SectionCard>`, DON'T copy `bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md`". "DON'T use `text-emerald-600`, DO use `text-accent`". "DON'T use `dark:text-[#ff8585]`, DO use `dark:text-danger`".

---

### Commit 9 — Fix off-palette colors in `globals.css` (P2 cleanup)

Audit `globals.css` to confirm `dark:text-danger` resolves to the correct shade. Add alias tokens if any dark-mode hex values do not have a corresponding named token (e.g. the `#0f5132` text colour on success blocks has no token at all). The goal is that every hard-coded hex `dark:text-[#...]` in the codebase has a named token equivalent to migrate to.

---

### Commit 10 — Migrate `dashboard/page.tsx` to primitives

Replace in the dashboard page:

- `<AppHeader ...> + <main className="max-w-275 ...">` → `<PageLayout user={user}>`
- All 4 section divs (`bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md`) → `<SectionCard>`
- Section `h2` elements → `<SectionCard.Header icon={...} title="..." />`

Run `bun run build` and verify visually after this commit.

---

### Commit 11 — Migrate `history/page.tsx` to primitives

Replace:

- `<AppHeader> + <main>` → `<PageLayout user={user}>`
- Inline `h1 + p + Link` header block → `<PageHeader backHref="/dashboard">`
- 6 stat card divs → `<StatCard>`
- 12 badge label instances → `<Badge>`
- Section panel divs → `<SectionCard>`

Run `bun run build` and verify visually.

---

### Commit 12 — Migrate `review/page.tsx` and `settings/page.tsx`

Review page:

- `<AppHeader> + <main>` → `<PageLayout user={user}>`
- `h1 + p` → `<PageHeader>`

Settings page:

- `<AppHeader> + <main>` → `<PageLayout user={user}>`
- Final section card → `<SectionCard>`

Run `bun run build` and verify visually.

---

### Commit 13 — Migrate landing page `page.tsx` (Badge + Button only)

The landing page has its own layout (no `PageLayout`). Only migrate the shared primitives:

- 6 badge label divs → `<Badge variant="default">`
- 4 `<Link>` elements with inline primary button styles → `<Button asChild><Link>...</Link></Button>`
- 3 pain-point cards (structurally identical) → extract a `<PainPointCard>` sub-component in `/components/landing/`

---

## Decision Document

### New modules to be created

- `src/components/ui/badge.tsx` — `Badge`, `badgeVariants`
- `src/components/ui/section-card.tsx` — `SectionCard` with compound sub-components
- `src/components/ui/stat-card.tsx` — `StatCard`
- `src/components/ui/page-layout.tsx` — `PageContainer`, `PageLayout`
- `src/components/ui/page-header.tsx` — `PageHeader`
- `docs/design-system.md` — design system documentation

### Modules to be modified (extend only, backward-compatible)

- `src/app/globals.css` — fix `--surface-active` token (P0 bug), add typography reference comment, add `.hover-shadow-accent` utility
- `src/components/ui/button.tsx` — add `asChild` prop via Radix Slot
- `src/app/dashboard/page.tsx` — migrate to primitives
- `src/app/history/page.tsx` — migrate to primitives
- `src/app/review/page.tsx` — migrate to primitives
- `src/app/settings/page.tsx` — migrate to primitives
- `src/app/page.tsx` — partial migration (Badge + Button)

### Interfaces that will NOT change

- Server Actions, API routes, domain layer, database schema — untouched
- `AppHeader` component interface — unchanged (only wrapped by `PageLayout`)
- All components under `/components/dashboard/`, `/components/lesson/`, `/components/settings/` — out of scope for this refactor

### Dependency order

```text
globals.css (P0 fix + tokens)
  → Button (asChild + hover shadow)
  → Badge
  → StatCard
  → SectionCard
  → PageHeader
  → PageLayout (wraps AppHeader, does not modify it)
    → dashboard page
    → history page
    → review + settings pages
    → landing page (partial)
```

### Architectural decision: Compound components for SectionCard

`SectionCard.Header` / `SectionCard.Body` / `SectionCard.Footer` use the compound component pattern because body content is too varied to pass through props. The pattern is flexible, requires no prop drilling, and is easy to extend later.

### Architectural decision: PageLayout receives a `user` object, not individual props

Pass `user: { email, role, image }` rather than `email`, `isAdmin`, and `image` separately — avoids verbose prop forwarding at every call site and is easy to extend with new fields later.

### Architectural decision: SectionCard ≠ existing Card

The existing `Card` uses `shadow-sm`. `SectionCard` uses `shadow-md` and `p-5 sm:p-8`. They serve different purposes and should coexist.

---

## Testing Decisions

### What makes a good test for this layer?

Tests should verify **external behavior**, not specific class names:

- `Badge` renders the correct ARIA role and text content for each variant
- `PageHeader` renders a back-link element with the correct `href` when `backHref` is provided
- `StatCard` renders the correct label and value text
- `SectionCard.Header` renders an `h2` with the correct title text
- `PageLayout` renders children inside a `<main>` element

### Modules to be tested

- `Badge` — unit tests with Vitest + React Testing Library
- `PageHeader` — unit test for back-link `href` rendering
- `SectionCard` — smoke test for compound sub-components
- `StatCard` — unit test for variant value rendering

### Prior art in the codebase

- `src/components/ui/dialog.test.tsx` — pattern for testing a UI component with RTL
- `src/components/exercise-card.test.tsx` — pattern for testing a more complex component with user interaction

---

## Out of Scope

- No changes to domain logic, server actions, or database schema
- No changes to the overall visual design (colors, dark mode palette — only enforce existing tokens)
- No refactor of components under `/components/lesson/` — separate PR
- No decomposition of `grading-feedback.tsx` or `exercise-card.tsx` into sub-components — separate PR on component architecture
- No Storybook, new animation libraries, or new testing frameworks
- No browser extension, payment, or social features

---

## Further Notes

### Commit 1 is the most urgent

The `--surface-active` fix (Commit 1) is a real bug and should be merged independently even if the remaining commits are delayed.

### Safe but immediately impactful

Commits 1–8 only add new files and extend `globals.css` — zero risk of regression. Commits 9–13 are migrations with a build verification step after each one.

### Suggested priority if time is limited

Commit 1 (P0 bug) > Commit 3 (Button asChild) > Commit 5 (SectionCard) > Commit 4 (Badge) > Commit 8 (docs) > migration commits.

Rationale: `SectionCard` has the highest impact (20+ sites), followed by `Badge` (12+ sites). `PageLayout`/`PageHeader` have lower immediate impact but are important for long-term maintainability.

### Enforcement after completion

Add to `AGENTS.md`: "All new pages must use `<PageLayout>`. All section cards must use `<SectionCard>`. All label badges must use `<Badge>`."
