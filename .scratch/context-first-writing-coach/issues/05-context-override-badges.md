Status: ready-for-agent

## Parent

[PRD: Context-first Writing Coach](./../PRD.md)

## What to build

Display the auto-detected DocumentType and Formality as two interactive badges on the lesson result page, and allow the learner to override either axis — triggering a full re-analysis with the new context.

Specifically:

- **Two badges** in the lesson header area (or above the diff view):
  - DocumentType badge showing the detected value with an icon (e.g., `📧 Email`, `💬 Chat`, `🎫 Ticket`, `👀 Code Review`, `📄 Technical Doc`, `📝 Meeting Notes`, `🌐 General`).
  - Formality badge showing the detected value (e.g., `Formal`, `Semi-formal`, `Casual`).
- **Click interaction**: clicking a badge expands a chip list underneath it. The learner selects a different value. A confirmation prompt appears: "Đổi bối cảnh sẽ phân tích lại toàn bộ. Tiếp tục?" On confirm, call the new Server Action.
- **New Server Action `changeLessonContextAction(lessonId, newDocumentType?, newFormality?)`**: updates the lesson's `text_type` and/or `formality` columns, deletes existing child records (correction items, key phrases, sentence breakdowns, lesson focuses, exercises), sets `analysisStatus = 'pending'`, and queues a new analysis generation job via the existing job pipeline. The learner sees the GenerationProgress UI while re-analysis runs.
- The badge values should come from the lesson data already passed to the layout (Slice 04 passes `lesson.textType` and `lesson.formality`).
- For lessons with `formality = null` (legacy), show "Auto" or hide the formality badge.

## Acceptance criteria

- [ ] DocumentType badge renders with correct icon and label based on `lesson.textType`
- [ ] Formality badge renders with correct label based on `lesson.formality`
- [ ] Clicking a badge shows a chip list with all available values for that axis
- [ ] Selecting a different value shows a confirmation prompt
- [ ] `changeLessonContextAction` updates `text_type` and/or `formality` on the lesson
- [ ] `changeLessonContextAction` deletes existing correction items, key phrases, sentence breakdowns, lesson focuses, and exercises
- [ ] `changeLessonContextAction` sets `analysisStatus = 'pending'` and queues a new analysis job
- [ ] After re-analysis, the lesson page shows updated corrections and cultural notes for the new context
- [ ] Legacy lessons without `formality` show gracefully (no crash, badge shows "Auto" or is hidden)
- [ ] `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` all pass

## Blocked by

- [04: culturalNoteVi + tone banner + accept/reject](./04-cultural-note-tone-banner-accept-reject.md)
