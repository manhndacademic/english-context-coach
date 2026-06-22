Status: ready-for-agent

# Context-first Writing Coach with 2-axis CommunicationContext

## Problem Statement

The learner writes English for work — emails to clients, Slack messages to colleagues, Jira tickets, PR comments, solution design documents, meeting notes — and relies on external AI (ChatGPT, Grammarly) to correct it. The current app requires pasting both the original and the corrected version (2 pastes), which creates friction and limits learning to surface-level grammar fixes. More critically, the app has no awareness of _what kind_ of document the learner is writing or _how formal_ it should be. An email to a client and a Slack message to a teammate require different vocabulary, tone, hedging, and cultural conventions — but the app treats them identically. The result: corrections feel generic, cultural explanations are missing, and the learner doesn't develop an intuition for register-appropriate English in their specific work context.

## Solution

Shift the primary learning flow from diff-first (2 pastes) to context-first writing coach (1 paste). The learner pastes a single text, the app auto-detects the **DocumentType** (email, chat message, ticket, code review, technical doc, meeting notes, general) and **Formality** (formal, semi-formal, casual) from the text content, then generates culturally-aware corrections calibrated for that specific communication context. Each correction includes a Vietnamese cultural explanation (culturalNoteVi) that teaches _why_ the suggestion is more appropriate — not just _what_ changed. The learner can override either axis on the result page and re-analyze. The learner can also directly edit the AI's suggested corrections when they are wrong or over-corrected.

## User Stories

1. As a learner, I want to paste a single English text and have the app analyze it, so that I don't need to visit ChatGPT first and paste two versions.
2. As a learner, I want the app to auto-detect that my text is an email (vs a Slack message vs a Jira ticket), so that corrections are calibrated for the right document type without me having to choose.
3. As a learner, I want the app to auto-detect the formality level of my text (formal, semi-formal, casual), so that corrections match the register I'm writing in.
4. As a learner, I want to see the detected DocumentType and Formality as badges on the result page, so that I know how the app interpreted my text.
5. As a learner, I want to change the DocumentType badge (e.g., from "chat_message" to "email") on the result page, so that I can correct the app when it detects wrong and get corrections calibrated for the right context.
6. As a learner, I want to change the Formality badge (e.g., from "casual" to "formal") independently of DocumentType, so that I can see how the same text should be written more or less formally.
7. As a learner, I want changing DocumentType or Formality to trigger a full re-analysis, so that all corrections, cultural notes, and exercises are recalibrated for the new context.
8. As a learner, I want the input form to remain minimal (one textarea, no dropdowns), so that pasting is fast and frictionless.
9. As a learner, I want the app to generate an improved version (AppSuggestion) of my text, so that I can see concretely how my writing could be better.
10. As a learner, I want each correction to include a culturalNoteVi explaining _why_ the change is more appropriate in this context (not just grammar rules), so that I develop cultural intuition for English communication.
11. As a learner, I want corrections for a formal email to teach hedging ("I would suggest..." instead of "You should..."), greeting/closing conventions, and polite indirectness, so that I write professional emails that native speakers respect.
12. As a learner, I want corrections for a Jira ticket to teach acceptance criteria format, imperative mood, and concise technical writing, so that my tickets are clear and professional.
13. As a learner, I want corrections for a PR code review to teach technical directness, "nit:"/"LGTM" conventions, and suggestion-vs-request tone, so that my code reviews are received well by teammates.
14. As a learner, I want corrections for a chat message to allow contractions and informal language while still catching genuine errors, so that the app doesn't over-correct my casual communication.
15. As a learner, I want corrections for a technical document to teach passive voice conventions, section structure, and hedging in design rationale, so that my documentation reads professionally.
16. As a learner, I want to edit the AI's suggested corrected phrase directly on each correction card (✏️ button), so that I can fix cases where the AI over-corrected or suggested something I disagree with.
17. As a learner, I want my edited corrections to be used as the basis for exercises, so that I practice the phrasing I actually chose — not the AI's original suggestion.
18. As a learner, I want to accept or reject each individual correction, so that I keep my original phrasing when I prefer it and only learn from suggestions I agree with.
19. As a learner, I want rejected corrections to still appear as "good to know" items, so that I'm aware of alternatives even if I chose not to adopt them.
20. As a learner, I want to see an overall tone analysis banner at the top of the diff view, so that I understand how my text sounds as a whole (e.g., "Your email sounds too direct for a formal context").
21. As a learner, I want the app to still work when I paste text from someone else (read mode), so that I can understand emails, Slack messages, or documentation I received.
22. As a learner, I want the app to still support the optional "I have a corrected version" expander (diff mode), so that power users who prefer external correction tools can still use that workflow.
23. As a learner, I want old lessons (created before this feature) to continue working normally, so that my learning history isn't broken.
24. As a learner, I want a banner when a correction matches a previous MistakePattern, so that I'm aware of recurring weaknesses specific to certain document types.
25. As a learner, I want scaffolded exercises (recognize → guided → produce) generated from each correction, so that I deeply encode the correction through progressive practice.
26. As a learner, I want to retry a failed exercise once immediately, so that I can correct my understanding while feedback is fresh.

## Implementation Decisions

### Domain Model Changes (CONTEXT.md, ADR-0022)

- **CommunicationContext** redefined as the composite of two independent axes: **DocumentType** × **Formality**. Not a flat enum.
- **DocumentType**: the kind of written artifact. Values: `email`, `chat_message`, `ticket`, `code_review`, `technical_doc`, `meeting_notes`, `general`. Legacy values `work_message`, `article`, `academic`, `unknown` remain for backward compatibility.
- **Formality**: the register/tone level. Values: `formal`, `semi_formal`, `casual`.
- **AppSuggestion**: the app-generated improved version of the learner's DraftText, calibrated to the detected CommunicationContext.
- Each **CorrectionItem** gains a `culturalNoteVi` field explaining cultural/register reasoning.
- Recorded in ADR-0021 (context-first writing coach) and ADR-0022 (two-axis communication context).

### DB Schema Strategy: Extend, Not Replace

- The existing `text_type` pgEnum is extended with 4 new values: `chat_message`, `ticket`, `code_review`, `meeting_notes`. No values removed.
- A new `formality` pgEnum (`formal`, `semi_formal`, `casual`) is created.
- The `lessons` table gains a nullable `formality` column and a nullable `suggestedText` column (stores the full AppSuggestion).
- The `correction_items` table gains a nullable `culturalNoteVi` column.
- In the TypeScript domain layer, `textType` is aliased as `DocumentType` for clarity. The DB column name stays `text_type`.
- Old lessons with `formality = null` are valid — treated as "not yet detected" and can be re-analyzed.

### Writing Coach Engine

- New `WritingCoachPrompt` class accepts DraftText and instructs the AI to: (1) detect DocumentType and Formality, (2) generate an AppSuggestion, (3) produce CorrectionItems with culturalNoteVi, and (4) provide an overall tone analysis.
- The engine runs the existing deterministic `diffWords()` between DraftText and AppSuggestion to produce the visual Word Diff, then merges AI-classified CorrectionItems.
- Job routing in `processJob()`: DraftText without user-provided SourceText → writing coach engine. DraftText with user-provided SourceText → existing diff engine. No DraftText → existing analysis engine.

### Auto-detection, Not Pre-selection

- The input form has no DocumentType or Formality selectors. The user pastes and submits.
- The AI detects both axes during analysis. The detected values are stored on the Lesson.
- Override happens only on the result page via clickable badges. Changing either badge triggers a full re-analysis (delete child tables, re-queue analysis job).

### Correction Card Editing

- Each correction card has an edit button (✏️). Clicking it turns the corrected phrase into an editable text input.
- Saving updates the `correctedPhrase` in the database directly.
- The edited phrase becomes the basis for exercise generation.

### Override Server Actions

- `changeLessonContextAction(lessonId, newDocumentType?, newFormality?)` — updates the lesson's context, clears analysis results, and re-queues for analysis.
- `updateCorrectionPhraseAction(lessonId, correctionItemId, newPhrase)` — updates a single correction's suggested phrase in-place.
- Both are thin Server Actions that delegate to existing repository methods.

### Exercise Generation (unchanged from ADR-0020)

- Each CorrectionItem produces 3 scaffolded exercises: recognize → guided → produce.
- Repeated-mistake CorrectionItems skip recognize (start at guided).
- Exercise generation uses the existing `DiffExercisesPrompt` and exercise type enum.

## Testing Decisions

A good test for this feature exercises external behavior at the highest seam — verifying that correct CorrectionItems with culturalNoteVi and detected context are produced from given inputs, without testing AI prompt formatting or internal diff algorithms.

### Primary Test Seam: `LessonGenerationEngine`

- **Writing coach flow**: Given a DraftText (no user-provided SourceText), verify that `queue()` stores DraftText, routes to writing coach engine, and produces CorrectionItems with culturalNoteVi, detected DocumentType, and detected Formality.
- **Diff mode fallback**: Given DraftText + user-provided SourceText, verify the existing diff pipeline is used unchanged.
- **Read mode fallback**: Given a single text (no DraftText), verify the existing analysis pipeline is used unchanged.

### Secondary Test Seam: `GenerationEngine.generateWritingCoachAnalysis()`

- Given a DraftText, verify the writing coach prompt produces: an AppSuggestion (full improved text), CorrectionItems with culturalNoteVi, a detected DocumentType, and a detected Formality.
- Verify that the deterministic `diffWords()` between DraftText and AppSuggestion aligns with the AI-produced CorrectionItems.

### No New Seam for Override

- `changeLessonContextAction` and `updateCorrectionPhraseAction` are thin Server Actions. They are tested through the existing `LessonContentRepository` seam (verify that calling update methods produces the expected DB state).

### Prior Art

- `src/domain/lesson/engine.test.ts` — lesson generation pipeline tests with mocked `GenerationEngine`.
- `src/domain/lesson/diff-engine.test.ts` — deterministic diff algorithm tests.
- `src/domain/memory/engine.test.ts` — attempt submission and MistakePattern lifecycle.

## Out of Scope

- **Browser extension** for capturing corrections from ChatGPT/Grammarly directly.
- **Mobile native app** — web-only for now.
- **Migrating old lessons** — old lessons continue working in their original mode.
- **Social/collaborative features** — leaderboard, sharing, team learning.
- **Payment/subscription** — experimental phase, single user.
- **Custom DocumentType creation** — the 7+4 legacy values are sufficient. Users cannot add their own document types yet.
- **Per-DocumentType exercise templates** — exercises use the same scaffolding structure regardless of document type. DocumentType only affects the AI's correction and explanation content, not the exercise format.
- **Formality comparison mode** — no side-by-side view of how the same text would be corrected at different formality levels. Override re-analyzes and replaces.
- **AI-powered correction quality scoring** — no automated evaluation of whether the AI's corrections are good enough. Quality is validated manually.

## Further Notes

- The 2-axis CommunicationContext model (ADR-0022) is designed with DDD extensibility in mind. Adding a new DocumentType (e.g., `confluence_page`, `contract`) is a single enum extension + prompt update. Adding a new Formality level (e.g., `very_formal` for legal contexts) is independent of DocumentType. Neither change affects the other axis.
- The writing coach prompt is the highest-risk component. If AI correction quality is poor for a specific DocumentType, the entire feature underdelivers for that document type. Block 1 implementation should include manual quality validation across all 7 DocumentTypes before proceeding to Block 2.
- This PRD partially supersedes the diff-first-learning-flow PRD. The diff engine, CorrectionItem schema, DiffLessonLayout, and scaffolded exercises from that PRD are preserved and reused. Only the input method (1 paste vs 2) and the addition of CommunicationContext/culturalNoteVi are new.
- DocumentType naming deliberately avoids tool-specific names (e.g., `chat_message` not `slack_message`) because communication patterns outlast specific tools. The AI prompt should reference patterns, not products.
