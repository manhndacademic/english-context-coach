# Diff-first Learning Flow

The app's primary user writes English for work (emails, messages, documents), asks AI to correct it, and then forgets the corrections. After many iterations, nothing sticks. The existing flow treated all pasted text as "material to understand" — but the real learning opportunity is the _delta_ between what the user wrote and what was corrected.

We restructure the learning flow around a diff-first model: the learner pastes their DraftText alongside the AI-corrected SourceText, and the app generates CorrectionItems from the differences. Each CorrectionItem produces scaffolded exercises (recognize → guided fill → active production) instead of generic text-analysis exercises.

## Considered Options

1. **Keep single-text input, AI analyzes everything** — simpler input, but misses the learner's actual weakness (the corrections they received).
2. **AI corrects the draft itself** — replaces external AI tools, but the app's correction quality won't match specialized tools the user already trusts.
3. **Diff-first: user provides both versions** — higher input friction (two pastes), but the app sees exactly where the learner struggles and generates targeted exercises.

We chose option 3 because the entire product thesis — personal error memory and repeated mistake detection — depends on knowing _what the learner actually got wrong_, not what the app guesses they might misunderstand.

## Consequences

- **Input mode consolidation**: Six input modes collapse to two — diff mode (primary, when DraftText is provided) and understand mode (secondary, single text). Four specialized modes (fix_and_understand, naturalize_english, mixed_language_support, developer_error_explanation) are removed.
- **Diff engine**: A hybrid approach — deterministic text diff to find changes, then AI to classify error types, explain corrections, and generate exercises. Avoids sending full text to AI when only a few words changed.
- **ErrorRepairSession deprecated**: Replaced by in-place quick retry on each exercise. Failed items enter the review schedule instead of blocking lesson completion.
- **Review unification**: MistakePattern and PhrasePractice reviews merge into a single learner-facing session, with context replay for recent items (≤3 days) and new-context flashcards for older items (7+ days).
- **Schema additions**: `draft_texts` and `correction_items` tables added. Existing lessons without a DraftText continue to work in understand mode.
