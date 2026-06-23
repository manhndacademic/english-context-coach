# Improve dashboard lesson cards and migrate pages to primitives

Status: ready-for-agent

## Parent

[PRD.md](../PRD.md)

## What to build

Dashboard lesson card titles are truncated to a single line with `text-overflow: ellipsis`, making it hard to distinguish lessons. Fix the cards and migrate app pages to use the new design system primitives.

1. **Improve lesson card layout**: Change title from `truncate` (1 line) to `line-clamp-2` (2 lines). Add min height `min-h-[72px]`. Bump desktop font size. Add `title` attribute for tooltip on long titles.

2. **Migrate dashboard page**: Replace `<AppHeader> + <main>` with `<PageLayout>`, section divs with `<SectionCard>`, h2 elements with `<SectionCard.Header>`.

3. **Migrate history page**: Replace stat divs with `<StatCard>`, badge labels with `<Badge>`, sections with `<SectionCard>`.

4. **Migrate review and settings pages**: Replace headers with `<PageLayout>`, sections with `<SectionCard>`.

5. **Partial landing page migration**: Badge labels → `<Badge>`, link buttons → `<Button asChild><Link>`.

Verify each page visually after migration, including dark mode.

## Acceptance criteria

- [ ] Lesson card titles show up to 2 lines (not truncated to 1)
- [ ] Lesson cards have minimum height for consistent visual weight
- [ ] Dashboard page uses `PageLayout`, `SectionCard` primitives
- [ ] History page uses `StatCard`, `Badge`, `SectionCard` primitives
- [ ] Review and settings pages use `PageLayout`, `SectionCard`
- [ ] Landing page badges and button links use `Badge` and `Button asChild`
- [ ] All migrated pages render correctly in dark mode
- [ ] `bun run test` passes
- [ ] `bun run build` passes
- [ ] Manual test: dashboard lesson titles are readable, not harshly truncated

## Blocked by

- [05-design-system-primitives](05-design-system-primitives.md) — pages need primitives to exist before migration
