# Durable generation thoughts

Status: superseded by ADR-0007.

Lesson generation previously showed persisted `GenerationThought` summaries alongside durable `GenerationMilestone` history. P0 replaced that decision with application-controlled generation progress because learner progress must not depend on provider thought summaries.
