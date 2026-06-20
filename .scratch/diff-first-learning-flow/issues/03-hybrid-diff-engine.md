Status: ready-for-agent

## Parent

[Diff-first Learning Flow PRD](.scratch/diff-first-learning-flow/PRD.md)

## What to build

Create a hybrid diff engine in the lesson domain that extracts CorrectionItems from a DraftText + SourceText pair. The engine has two stages:

1. **Deterministic text diff**: Use a word-level diff algorithm to find raw differences between the DraftText and SourceText.
2. **AI classification**: Send the raw diffs (not the full texts) to the AI generation engine for classification — error type, Vietnamese explanation, literal trap detection, and example generation.

The output is a list of CorrectionItems saved to the database.

Plug this into the lesson generation pipeline: when `processJob` detects that a lesson has a linked DraftText, it routes to the diff engine instead of the standard full-text analysis. The diff engine replaces the analysis stage for diff-mode lessons. The analysis stage should still produce a minimal `SaveAnalysisInput` (title, textType, inputMode=`diff`, detectedLevel) but KeyPhrases and SentenceBreakdowns are replaced by CorrectionItems.

## Acceptance criteria

- [ ] Diff engine module exists in the lesson domain
- [ ] Given a DraftText + SourceText pair, produces CorrectionItems with: draftPhrase, correctedPhrase, explanationVi, literalTrapVi (when applicable), exampleEn, exampleVi, category, errorType
- [ ] Raw text diff is deterministic (no AI) — only classification uses AI
- [ ] CorrectionItems are persisted to the `correction_items` table
- [ ] `processJob` routes to diff engine when lesson has DraftText
- [ ] `processJob` routes to existing analysis when lesson has no DraftText (no regression)
- [ ] Unit tests for the text diff algorithm (given known inputs, verify expected raw diffs)
- [ ] Integration test: given DraftText + SourceText → CorrectionItems extracted correctly
- [ ] `bun run lint && bun run typecheck && bun run test && bun run build` all pass

## Blocked by

- `01-prefactor-widen-queue-for-draft-text`
