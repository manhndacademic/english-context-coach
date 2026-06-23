# Build design system primitives

Status: ready-for-agent

## Parent

[PRD.md](../PRD.md)

## What to build

The codebase has 20+ copy-pasted section card styles, 12+ duplicated badge patterns, 9+ repeated hover shadows, and 15+ hand-rolled button links. Build a primitives layer and document the design system.

1. **Extend `Button`** with `asChild` prop via `@radix-ui/react-slot` (already in deps) — enables `<Button asChild><Link>...</Link></Button>`. Add `hover-shadow-accent` to default variant.

2. **Create or upgrade `Badge`** with CVA variants: default, accent, success, warning, danger. Sizes: sm, md.

3. **Create `SectionCard`** compound component (Header/Body/Footer) — `shadow-md`, responsive padding `p-5 sm:p-8`. This coexists with the existing `Card` (different shadow level, different use case).

4. **Create `StatCard`** — value variants: default, accent, success, warning, danger.

5. **Create `PageLayout`** — wraps `<AppHeader>` + `<main max-w-[1100px]>`. Accepts `user` object prop.

6. **Create `PageHeader`** — h1 + back-link + description + actions slot.

7. **Fix off-palette dark-mode colors** in globals.css — ensure all `dark:text-[#...]` hex values have named token equivalents.

8. **Write `docs/design-system.md`** — color tokens reference, typography scale, spacing guidance, component inventory, Do/Don't rules.

All new components get unit tests. No existing pages are modified in this slice — migrations happen in issue 06.

## Acceptance criteria

- [ ] `Button` supports `asChild` prop and has `hover-shadow-accent` on default variant
- [ ] `Badge` component with 5 color variants and 2 sizes
- [ ] `SectionCard` compound component with Header/Body/Footer sub-components
- [ ] `StatCard` component with value variants
- [ ] `PageLayout` component wrapping AppHeader + main container
- [ ] `PageHeader` component with back-link and actions slot
- [ ] Off-palette dark-mode hex values have named token aliases in globals.css
- [ ] `docs/design-system.md` written with token reference, scale, and Do/Don't rules
- [ ] Unit tests for all new components
- [ ] `bun run test` passes
- [ ] `bun run build` passes

## Blocked by

- [01-fix-surface-active-token](01-fix-surface-active-token.md) — primitives build on corrected token definitions
