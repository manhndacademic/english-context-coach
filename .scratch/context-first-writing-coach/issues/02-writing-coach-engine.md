Status: completed

## Parent

[PRD: Context-first Writing Coach](./../PRD.md)

## What to build

Build the core Writing Coach engine: the AI prompt, Zod schema, generation function, and job routing. This is the heart of the feature — given a learner's DraftText (with no user-provided corrected version), the engine auto-detects DocumentType and Formality, generates an AppSuggestion (improved text), and produces CorrectionItems with culturalNoteVi explaining the cultural/register reasoning behind each correction.

Specifically:

- Create a `WritingCoachPrompt` class that instructs the AI to: (1) detect DocumentType from the text content, (2) detect Formality from the text content, (3) generate a full improved version (AppSuggestion), (4) produce CorrectionItems with `culturalNoteVi` for each change, and (5) provide an overall `toneAnalysisVi`.
- Create a `writingCoachAnalysisSchema` Zod schema that validates the AI's structured output, including `documentType`, `formality`, `suggestedText`, `toneAnalysisVi`, and corrections with `culturalNoteVi`.
- Add `generateWritingCoachAnalysis()` to the `GenerationEngine` interface and implement it in `GeminiGenerationEngine`. This function: calls WritingCoachPrompt → receives structured output → runs deterministic `diffWords()` between DraftText and suggestedText → merges AI CorrectionItems → returns `SaveAnalysisInput`.
- Update job-runner routing in `processJob()`: when `inputMode === "write"` (DraftText exists, no user-provided SourceText), route to `generateWritingCoachAnalysis()` instead of the standard analysis or diff engine.
- Write tests at the `LessonGenerationEngine` seam verifying: (a) write mode routes to writing coach, (b) diff mode still routes to diff engine, (c) read mode still routes to standard analysis.

The AI prompt should calibrate its correction behavior per DocumentType:

- `email`: teach greeting/closing conventions, hedging, polite indirectness
- `chat_message`: allow contractions, catch genuine errors only, teach thread etiquette
- `ticket`: teach acceptance criteria format, imperative mood, concise technical writing
- `code_review`: teach "nit:"/"LGTM" conventions, suggestion-vs-request tone
- `technical_doc`: teach passive voice conventions, section structure, hedging in rationale
- `meeting_notes`: teach action item format, attribution, tense consistency
- `general`: baseline English analysis

And per Formality:

- `formal`: strict on hedging, no contractions, full sentences, polite indirectness
- `semi_formal`: allow contractions, moderate directness, professional but approachable
- `casual`: minimal correction on tone, focus only on genuine errors

## Acceptance criteria

- [x] `WritingCoachPrompt` class exists and renders a prompt that detects DocumentType + Formality and generates corrections with culturalNoteVi
- [x] `writingCoachAnalysisSchema` validates AI output including `documentType`, `formality`, `suggestedText`, `toneAnalysisVi`, and corrections with `culturalNoteVi`
- [x] `GenerationEngine` interface includes `generateWritingCoachAnalysis()` method
- [x] `GeminiGenerationEngine` implements `generateWritingCoachAnalysis()` — calls prompt, runs `diffWords()`, merges results
- [x] Job-runner routes write mode (DraftText, no user SourceText) to writing coach engine
- [x] Job-runner continues routing diff mode and read mode to their existing engines (no regression)
- [x] Integration test: given a DraftText in write mode, `LessonGenerationEngine.processNext()` produces a Lesson with CorrectionItems containing `culturalNoteVi`, detected `textType` (DocumentType), and `formality`
- [x] `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` all pass

## Blocked by

- [01: Extend schema — DocumentType + Formality](./01-extend-schema-documenttype-formality.md)
