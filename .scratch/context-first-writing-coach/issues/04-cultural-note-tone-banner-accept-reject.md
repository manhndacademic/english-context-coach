Status: completed

## Parent

[PRD: Context-first Writing Coach](./../PRD.md)

## What to build

Enhance the DiffLessonLayout to display the new culturalNoteVi field on each correction card, add an overall tone analysis banner, and implement per-correction accept/reject toggles. This slice makes the writing coach output visible and interactive for the learner.

Specifically:

- **culturalNoteVi section** on each correction card: render the cultural/register explanation below the existing `explanationVi`. Style it distinctly (e.g., a bordered callout with a 🌏 icon) so the learner can distinguish grammar explanation from cultural reasoning. Only render when `culturalNoteVi` is non-null.
- **Tone analysis banner**: at the top of the diff view (above the Word Diff section), render a banner showing the overall tone assessment of the original text (from the lesson's `toneAnalysisVi` field stored in `contextExplanationVi` or a dedicated field). Example: "Văn bản của bạn nghe hơi trực tiếp cho email trang trọng — nên dùng hedging nhiều hơn."
- **Accept/reject toggle** per correction: each correction card gets a toggle (✅ accepted / ↩️ kept original). Default state is "accepted." Toggling to "rejected" visually dims the card and marks it as excluded from exercise generation. Store the state client-side initially (React state), persisting is optional for this slice.
- **Rejected corrections** still appear on the page (not hidden) with a "Tham khảo" (good to know) label, so the learner is still aware of the suggestion.
- Pass the `lesson.formality` and `lesson.textType` (DocumentType) data to the layout component so they're available for Slice 05 (context badges).

## Acceptance criteria

- [x] Each correction card displays `culturalNoteVi` when present, in a visually distinct callout
- [x] Correction cards without `culturalNoteVi` render without the callout (no empty space)
- [x] Tone analysis banner renders at the top of the diff view when data is available
- [x] Each correction card has an accept/reject toggle defaulting to "accepted"
- [x] Rejected corrections are visually dimmed with a "Tham khảo" label
- [x] Accept/reject state is tracked in component state
- [x] Existing diff mode lessons (without culturalNoteVi) continue to render correctly
- [x] `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` all pass

## Blocked by

- [02: Writing Coach Engine](./02-writing-coach-engine.md)
