Status: ready-for-agent

## Parent

[PRD: Context-first Writing Coach](./../PRD.md)

## What to build

Extend the database schema to support the 2-axis CommunicationContext model (ADR-0022). This is a prefactoring slice that makes subsequent slices easier by having the schema in place first.

Specifically:

- Extend the existing `text_type` pgEnum with 4 new values: `chat_message`, `ticket`, `code_review`, `meeting_notes`.
- Create a new `formality` pgEnum with 3 values: `formal`, `semi_formal`, `casual`.
- Add a nullable `formality` column (using `formalityEnum`) to the `lessons` table.
- Add a nullable `suggestedText` column (text) to the `lessons` table — stores the full AppSuggestion.
- Add a nullable `culturalNoteVi` column (text) to the `correction_items` table.
- In the TypeScript domain layer (`ports.ts`), extend the `TextType` union type with the new values. Add a `DocumentType` type alias for `TextType` for code clarity. Add `formality` to the `Lesson` interface and `culturalNoteVi` to the `CorrectionItem` interface. Add `formality` and `suggestedText` to `SaveAnalysisInput`.
- Generate the SQL migration file (`bun run db:generate`).
- Verify old lessons with `formality = null` continue to work (no breaking changes to existing queries or UI).

## Acceptance criteria

- [ ] `textTypeEnum` in `enums.ts` includes `chat_message`, `ticket`, `code_review`, `meeting_notes` alongside existing values
- [ ] New `formalityEnum` exists with `formal`, `semi_formal`, `casual`
- [ ] `lessons` table has nullable `formality` and `suggestedText` columns
- [ ] `correction_items` table has nullable `culturalNoteVi` column
- [ ] Domain `Lesson` interface includes `formality: Formality | null`
- [ ] Domain `CorrectionItem` interface includes `culturalNoteVi: string | null`
- [ ] `DocumentType` type alias exists in `ports.ts`
- [ ] Migration file generated and applies successfully on fresh DB (`bun run db:migrate`)
- [ ] `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` all pass
- [ ] Existing lesson pages render without errors (no regression)

## Blocked by

None — can start immediately
