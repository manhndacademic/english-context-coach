# Concept-level mistake patterns

MistakeConcepts represent underlying learner misunderstandings, while MistakePatterns preserve phrase-specific evidence. This replaces the earlier plan to make MistakePattern itself the concept-level unit, because review scheduling and mastery need one stable learning target while deletion and explanation still need the originating phrase, sense, and lesson evidence.

Considered options: keep `normalizedPhrase + senseKey + errorType` as the aggregate key; make every AI-classified concept authoritative; or introduce `MistakeConcept` with deterministic keys first and AI classification only as a fallback. We chose the third option so related errors such as literal translations of "push this back" and "move the meeting back" can reinforce one concept without merging unrelated meanings merely because words overlap.
