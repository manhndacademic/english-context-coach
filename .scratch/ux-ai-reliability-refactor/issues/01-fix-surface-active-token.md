# Fix P0: Define `--surface-active` token and hover shadow utility

Status: done

## Parent

[PRD.md](../PRD.md)

## What to build

The design token `--surface-active` is referenced by `hover:bg-surface-active` in three major interactive components (exercise cards, grading feedback, review cards) but was never defined in the theme. Hover states fail silently — the app feels unresponsive with no visible cause.

Define the token in both light and dark theme blocks in globals.css (light: `rgba(5,150,105,0.06)`, dark: `rgba(16,185,129,0.08)`), register it in the `@theme` block, and add a `.hover-shadow-accent` CSS utility class to replace the 9+ occurrences of the arbitrary hover shadow value `hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)]`.

Also add a typography scale reference comment block to globals.css documenting the canonical size mappings (xs through 4xl).

This is a pure CSS fix — no component code changes. Verify by building and confirming hover states work on exercise cards.

## Acceptance criteria

- [x] `--surface-active` token defined in light and dark theme blocks in globals.css
- [x] Token registered in `@theme` block so Tailwind recognizes `bg-surface-active`
- [x] `.hover-shadow-accent` utility class defined in globals.css
- [x] Typography scale reference comment block added
- [x] `bun run build` passes with no Tailwind warnings
- [x] Exercise card, grading feedback, and review card hover states are visually verified

## Blocked by

None — can start immediately.
