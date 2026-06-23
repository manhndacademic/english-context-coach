# Add toast notification system and replace all `window.alert()`

Status: done

## Parent

[PRD.md](../PRD.md)

## What to build

The app uses `window.alert()` for all 7 user-facing error paths — a jarring browser popup with no styling or context. Replace with a professional toast notification system.

1. **Install Sonner** (`bun add sonner`) and add `<Toaster />` to the root layout with theme-aware config (respects dark mode, positioned bottom-right).

2. **Replace all `window.alert()` calls** (4 in DiffLessonLayout, 2 in source-text-form, 1 in readable-source-text) with typed toasts: `toast.error()` for errors, `toast.warning()` for warnings.

3. **Replace `window.confirm()`** in DiffLessonLayout's context override flow with the existing `ConfirmDialog` component.

Verify by triggering error conditions and confirming styled toast notifications appear instead of browser alerts.

## Acceptance criteria

- [x] Sonner installed and `<Toaster />` in root layout
- [x] Toast wrapper component created in UI primitives directory with theme-aware defaults
- [x] Zero `window.alert()` calls remain in the codebase
- [x] Zero `window.confirm()` calls remain in component code
- [x] Error toasts appear for AI/clipboard errors
- [x] `bun run test` passes (component tests updated)
- [x] `bun run build` passes
- [x] Manual test: trigger clipboard error → toast appears, not browser alert

## Blocked by

- [01-fix-surface-active-token](01-fix-surface-active-token.md) — toast theming relies on design tokens being correctly defined
