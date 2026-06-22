# Two-axis CommunicationContext: DocumentType × Formality

ADR-0021 introduced CommunicationContext as a flat enum (`formal_email`, `casual_slack`, `internal_team`, `academic`, `general`). In practice this list was both too narrow for the software industry and structurally wrong — it conflated two independent concerns: what kind of document the learner is writing (email vs Jira ticket vs PR comment vs solution design) and how formal the writing should be (client-facing vs internal vs casual chat). Adding a new document type required N×M new enum values, and the AI prompt couldn't independently calibrate vocabulary/structure (driven by document type) and strictness/politeness (driven by formality).

We split CommunicationContext into two independent axes stored as separate columns on the Lesson:

- **DocumentType** — reuses and extends the existing `text_type` pgEnum. New values: `chat_message`, `ticket`, `code_review`, `meeting_notes` added alongside existing `email`, `technical_doc`, `general`, `article`, `academic`, `work_message`, `unknown`. Each type teaches different domain vocabulary, structural conventions, and phrasing patterns.
- **Formality** — new `formality` pgEnum with 3 values: `formal`, `semi_formal`, `casual`. Determines AI strictness for politeness, hedging, directness, and cultural conventions.

## Considered Options

1. **Flat enum** — one `communicationContext` column with combined values like `formal_email`, `casual_jira`. Simple schema but combinatorial explosion and can't calibrate the two axes independently.
2. **Replace textTypeEnum** — drop old enum, create new `documentType` enum. Clean slate but complex migration for existing lessons and loses backward-compatible values.
3. **Extend textTypeEnum + add formality** — keep the existing `text_type` column, add new values, add a separate `formality` column. Minimal migration, backward compatible, DDD-friendly extensibility.

We chose option 3. The existing `text_type` column and its values remain valid. Adding a DocumentType is a single enum extension; adding a Formality is independent. The AI prompt receives both axes separately and can calibrate vocabulary/structure from DocumentType and strictness/tone from Formality.

## Consequences

- `text_type` pgEnum gains 4 new values: `chat_message`, `ticket`, `code_review`, `meeting_notes`. Requires a DB migration.
- New `formality` pgEnum (`formal`, `semi_formal`, `casual`) and nullable `formality` column on `lessons` table. Old lessons have `formality = null` (treated as auto-detect on re-analysis).
- In TypeScript domain layer, `textType` is aliased to `DocumentType` for clarity. DB column name stays `text_type` to avoid schema rename migration.
- AI analysis prompt must detect and output both `textType` and `formality`. Writing coach prompt uses both to calibrate corrections.
- Override UI on lesson result page shows two badges (DocumentType + Formality) that the learner can change independently, triggering re-analysis.
- ADR-0021's single `CommunicationContext` is now the composite of these two axes, not a standalone value.
