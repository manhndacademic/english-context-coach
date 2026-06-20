# Split MistakePattern and Proactive PhrasePractice

## Context

Originally, the system used the `MistakePattern` aggregate for both reactive user error review and proactive vocabulary practice. This unified approach resulted in a shared database schema with nullable fields (like `source` and `keyPhraseId` in `mistake_patterns`), transitional fallback logic in repositories, and mixed-model code paths.

As the product evolved, it became clear that mistake memory (reactive learning from errors) and active vocabulary training (proactive phrase learning) have distinct lifecycles, user interfaces, and business logic:

- `MistakePattern` is strictly generated from user mistakes during exercises. It represents concept-level repeated weaknesses.
- `PhrasePractice` is strictly generated from lesson key phrases when a lesson is completed, allowing users to build proactive memory of vocabulary.

## Decision

We split the review system into two separate, first-class domains, repositories, and database tables:

1. `MistakePattern` represents concept-level repeated weaknesses based on raw user error memory.
   - Dropped `source` and `keyPhraseId` columns from the `mistake_patterns` table.
   - Removed legacy `MistakePatternSource` and `reviewSourceEnum` types.
2. `PhrasePractice` represents proactive phrase learning scheduled via spaced repetition.
   - Dropped the redundant `source` column from the `phrase_practices` table.
3. Cleaned up all mixed-model paths in queries, repositories, and domain aggregates.
4. Updated the study history page to query both repositories and merge the two items sorted by `updatedAt` desc with distinct badges and links.

## Consequences

- Clear domain boundaries with no mixed-model compatibility code.
- Stronger alignment with the strategic moat: `MistakePattern` is dedicated entirely to personalized error review.
- Simplified database schema with no redundant discriminator columns.
- The history page and dashboard display separate, accurate metrics for mistakes and proactive vocabulary.
