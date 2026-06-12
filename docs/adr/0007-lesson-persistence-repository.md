# Lesson persistence repository

Background lesson generation is coupled to Drizzle database operations, making the background generation orchestrator difficult to unit-test. We decide to introduce a `LessonRepository` seam to encapsulate all database persistence, serialization, and sensitive content checks. This isolates Drizzle-specific table schemas from background workflows and allows mock-based unit testing of the generation progress state machine.
