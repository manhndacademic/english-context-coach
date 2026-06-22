Status: ready-for-agent

## Parent

[PRD: Context-first Writing Coach](./../PRD.md)

## What to build

Update the input form and Server Action to support the 1-paste write mode flow. The form remains minimal (no DocumentType/Formality selectors). When the learner pastes text without providing a corrected version, the app enters write mode: the pasted text becomes the DraftText, and the engine generates the SourceText (AppSuggestion) automatically.

Specifically:

- Update `source-text-form.tsx`: keep the single primary textarea. The optional "Tôi có bản đã sửa" expander remains for diff mode. Add a hidden `inputMode` field that sends `"write"` when no corrected text is provided (instead of the current `"understand_and_practice"`). Submit button text adapts: "Phân tích & cải thiện" (write mode) vs "Bắt đầu học" (read mode, when text quality is clearly native) vs "So sánh lỗi sai" (diff mode, when corrected text is provided).
- Update `createSourceTextAction` and its Zod schema to accept the new `"write"` inputMode value. In write mode: store the pasted text as both `content` (sourceText record) AND create a `draftText` record pointing to it. The writing coach engine (Slice 02) will later replace the sourceText content with the AppSuggestion.
- Update the `createSourceTextSchema` to include `"write"` in the `inputMode` enum.

The key behavioral change: previously, a single paste always meant "understand this text." Now, a single paste of learner-written text means "correct and teach me." The auto-detection of whether to use write mode vs read mode is handled by the AI in Slice 02 — this slice just needs to pass the right inputMode through.

## Acceptance criteria

- [ ] Form submits `inputMode: "write"` when no corrected text is provided
- [ ] Form submits `inputMode: "diff"` when corrected text is provided (unchanged behavior)
- [ ] `createSourceTextAction` creates a `draftText` record in write mode
- [ ] Submit button shows "Phân tích & cải thiện" in write mode
- [ ] Submit button shows "So sánh lỗi sai" in diff mode (unchanged)
- [ ] The optional "Tôi có bản đã sửa" expander still works for diff mode
- [ ] Learner is redirected to `/lessons/[id]` after submission (unchanged)
- [ ] `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` all pass

## Blocked by

- [02: Writing Coach Engine](./02-writing-coach-engine.md)
