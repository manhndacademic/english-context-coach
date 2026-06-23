# Fix Lesson page unlock flow and Word Diff rendering

Status: ready-for-agent

## Parent

[PRD.md](../PRD.md)

## What to build

The Lesson page has two UX problems:

**Unlock flow anti-pattern**: The exercise panel is visible on the right column but locked behind a blur overlay. The unlock CTA ("Đã hiểu ngữ cảnh, bắt đầu thực hành 🚀") is buried at the bottom of the left column — the learner must scroll past all explanation content. The overlay has a secondary "Mở khóa ngay" button, but it's tiny (`text-xs`).

Fix: Remove the scroll-dependent button at the bottom of the left column. Upgrade the overlay's unlock button to a full-size primary Button with pulse animation and descriptive microcopy ("Nhấn để bắt đầu luyện tập"). Apply this change to both StandardLessonLayout and DiffLessonLayout. Keep auto-unlock logic for lessons with previous attempts.

**Word Diff raw JSON**: In certain code paths, `draftContent` arrives as ProseMirror JSON instead of plain text, causing raw JSON to render in the Word Diff view.

Fix: Debug whether the issue is at the DB storage level or UI extraction level, and ensure plain text is used for diff rendering.

## Acceptance criteria

- [ ] No unlock button at the bottom of the left column in either layout
- [ ] Lock overlay button is full-size primary style with pulse animation
- [ ] Overlay includes microcopy explaining the action
- [ ] Auto-unlock still works for lessons with previous attempts
- [ ] Word Diff view renders formatted text, not raw JSON
- [ ] Changes applied to both StandardLessonLayout and DiffLessonLayout
- [ ] `bun run test` passes (layout tests updated)
- [ ] `bun run build` passes
- [ ] Manual test: open new lesson → unlock from overlay with 1 click, no scroll needed

## Blocked by

- [03-toast-notification-system](03-toast-notification-system.md) — overlay redesign uses toast for error feedback
