# Privacy-safe review prompts

Review prompts for MistakeConcepts should be privacy-safe and generalized rather than replaying original SourceText sentences. Reusing original context would make prompts richer and easier to generate, but long-term review memory should avoid exposing private names, project details, or sensitive source material while still practicing the learner's underlying misunderstanding.

Prompt snapshots may store generalized cloze text, choices, concept title, rubric, and learner-facing Vietnamese feedback. They must not store original private source sentences. Phrase-specific MistakePatterns and relational MistakeEvidence remain available for audit without copying source-identifying content into long-term review prompts.

## P0 correction

### Decision
Privacy-safe review prompts are not only generated at render time; the long-term concept seed and learner-facing concept text are also sanitized. Legacy sensitive seeds are corrected by an additive migration rather than rewriting migration history.

### Migration implication
`0005_p0_learning_loop_corrections.sql` generalizes existing concept and pattern learner-facing fields when regex detection finds common identifiers. It preserves relational lineage and mastery state.
