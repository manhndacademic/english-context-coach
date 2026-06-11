# Privacy-safe review prompts

Review prompts for MistakeConcepts should be privacy-safe and generalized rather than replaying original SourceText sentences. Reusing original context would make prompts richer and easier to generate, but long-term review memory should avoid exposing private names, project details, or sensitive source material while still practicing the learner's underlying misunderstanding.

Prompt snapshots may store generalized cloze text, choices, concept title, rubric, and learner-facing Vietnamese feedback. They must not store original private source sentences. Phrase-specific MistakePatterns and relational MistakeEvidence remain available for audit without copying source-identifying content into long-term review prompts.
