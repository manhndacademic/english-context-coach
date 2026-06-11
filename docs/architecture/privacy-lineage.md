# Privacy Lineage

## Problem

Source deletion must affect only learning memory caused by that source. The old deletion behavior scanned all patterns for sensitive-looking text, which could delete unrelated review memory for the same user.

## Current Behavior

Deleting a source loads all of the user's `MistakePattern` rows, applies text heuristics, deletes matching rows, and then deletes the source.

## Decision

Every `UserError` that contributes to review memory creates `MistakeEvidence` linking user, source, lesson, user error, pattern, and concept. Source deletion deletes evidence for that source only. Patterns and concepts are retained when other evidence remains and deleted when no evidence remains.

## Alternatives Considered

- Continue heuristic scanning: rejected because it is not lineage and can delete unrelated user memory.
- Never delete concepts: rejected because concepts without evidence become unauditable long-term memory.
- Copy original source snippets into evidence: rejected because evidence should be relational, not source-content storage.

## Data Model

`mistake_evidence` has `userId`, `mistakeConceptId`, `mistakePatternId`, `userErrorId`, `sourceTextId`, `lessonId`, and `createdAt`. Unique constraints prevent duplicate evidence for the same `UserError`.

## State Transitions

- New incorrect lesson attempt creates one `UserError`, one pattern, one concept, and one evidence row.
- Existing related errors reuse the concept and add evidence.
- Deleting one source deletes only evidence rows with that `sourceTextId`.
- A pattern with no evidence is deleted.
- A concept with no evidence is deleted.
- A mastered concept with remaining evidence stays in history.

## Privacy Implications

Evidence rows store identifiers only. Long-term review seeds are generalized and scrubbed. The source text remains only in `source_texts` and lesson-derived short fields until source deletion removes those rows.

## Failure Modes

- If deletion races with attempt submission, user ownership and unique constraints prevent cross-user or duplicate evidence.
- If evidence recomputation is needed, it must use relational links rather than regex ownership inference.

## Acceptance Criteria

- Deleting one contributing source preserves concepts with evidence from another source.
- Deleting the last contributing source removes the orphaned pattern and concept.
- Sensitive source text is not copied into review prompts.

## P0 correction: long-term learner-safe review storage and deletion

### Data classes
- Source-grounded temporary data: source text, lesson analysis, original exercises, and lesson attempts.
- Internal audit data: `UserError` and `MistakeEvidence`, which preserve relational lineage to the source that produced evidence.
- Long-term learner-facing data: `MistakeConcept.titleVi`, `MistakeConcept.explanationVi`, `safeReviewSeed`, and review prompt snapshots.

### Decision
Learner-facing review data is sanitized before storage. If deterministic checks see emails, URLs, ticket/project/client identifiers, names, or a sensitive source flag, the system stores a generic safe review seed instead of copying source-derived wording. Regex detection is a safety net, not ownership evidence; deletion and retention use `MistakeEvidence` relationships.

### Source deletion
Deleting a source removes only evidence from that source, recomputes retained pattern occurrence counts from remaining evidence, replaces retained concept/prompt text with generic safe wording when provenance may have changed, deletes patterns with no evidence, and deletes concepts with no evidence. Mastery history is preserved when evidence remains.

### Limitations
Regex-based sensitive-content detection cannot prove text is safe and may miss unusual identifiers. The conservative fallback is a generic privacy-safe prompt that preserves practice without replaying source details.
