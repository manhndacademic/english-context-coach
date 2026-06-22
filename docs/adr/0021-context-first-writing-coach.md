# Context-first Writing Coach

ADR-0020 established a diff-first learning flow where the learner pastes both their draft and an externally-corrected version. In practice, the two-paste requirement creates friction — the learner must first visit ChatGPT or Grammarly, copy the correction, return to the app, and paste again. More importantly, the diff-first approach narrows learning to error correction (grammar, vocabulary), missing the deeper goal: helping Vietnamese learners express ideas naturally and appropriately for the cultural context.

We shift the primary flow from diff-first to **context-first writing coach**: the learner pastes a single text, optionally selects a CommunicationContext (formal email, casual Slack, academic, etc.), and the app itself analyzes the text — correcting grammar, suggesting more natural phrasing, and explaining the cultural reasoning behind each suggestion. The app generates an AppSuggestion (the improved version) and produces CorrectionItems from the differences, reusing the existing diff infrastructure. The learner can accept or reject each suggestion individually.

## Considered Options

1. **Keep diff-first (ADR-0020)** — user provides both texts. Low AI risk but high UX friction. Limits learning to explicit corrections.
2. **Analysis-only writing coach (no correction)** — app identifies tone/culture issues and explains them, but doesn't generate a corrected version. Lower AI risk but less actionable — learner must figure out the fix themselves.
3. **Context-first writing coach with correction** — app corrects + explains + teaches from one paste. Higher AI dependency but eliminates friction, deepens learning to include culture and register, and reuses existing diff infrastructure.

We chose option 3. ADR-0020 rejected app-generated correction because "the app's correction quality won't match specialized tools the user already trusts." Since then, foundation model quality (Gemini 2.5, Claude Opus) has improved enough that correction quality is sufficient for learning purposes — the app doesn't need to be better than ChatGPT at correction, it needs to be good enough and then add the learning layer that ChatGPT lacks. The CommunicationContext selection and per-suggestion accept/reject give the learner control when the AI misjudges intent.

## Consequences

- **Three learning flows**: Write mode (primary — app corrects + teaches), Read mode (understand text from others), and Diff mode (optional — user provides both texts, for power users who prefer external correction tools). Auto-detected based on text quality and whether a second text is provided.
- **CommunicationContext added**: a learner-selected register hint (e.g., formal_email, casual_slack, internal_team, academic) that calibrates the AI's correction strictness and cultural explanations. Stored on the Lesson.
- **AppSuggestion**: the app-generated improved version of the learner's text, stored as the SourceText. The learner's original paste becomes the DraftText. This preserves the existing DraftText → SourceText → CorrectionItem pipeline.
- **Per-suggestion accept/reject**: learner can keep their original phrasing for individual corrections. Rejected corrections are excluded from exercises but optionally shown as "good to know."
- **Cultural explanations elevated**: each CorrectionItem gains a culturalNoteVi field explaining the cultural/register reasoning, not just the linguistic fix.
- **ADR-0020 partially superseded**: the diff engine, CorrectionItem schema, DiffLessonLayout, and scaffolded exercise design from ADR-0020 are preserved and reused. Only the input method changes (1 paste instead of 2).
