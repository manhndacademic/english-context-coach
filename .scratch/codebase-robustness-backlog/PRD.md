Status: ready-for-agent

## Problem Statement

The English Context Coach codebase has grown significantly, adding many features like AI grading, key rotation, spaced repetition memory, and background workers. However, as code volume increases, stability and maintainability issues have emerged:

1. **Fragile AI Key and Model Rotation**: The rotation and cooldown logic for API keys and model pools is tightly coupled inside the main AI provider call flow, making it hard to test, debug, and trace when keys get exhausted.
2. **Crash-Prone JSON Parsing**: Minor formatting anomalies returned by the LLM (like carriage returns or nested braces) can cause JSON parsing or schema validation failures, breaking the learning flow for users during grading or lesson analysis.
3. **Database Types & Any Leakage**: Several repository adapters use generic `any` types or bleed DB-specific types into the clean domain layer, which reduces TypeScript type safety.
4. **Stuck Background Jobs**: Worker instances processing lesson analysis or exercise generation could crash or restart, leaving jobs orphaned in the database in a perpetual `running` state.

To ensure long-term stability and easier maintainability, these four technical debts need to be systematically addressed.

## Solution

We will catalog these four refactoring candidates in the backlog so that developers or autonomous agents can pick them up and execute them one by one. The proposed refactoring candidates are:

1. **AI Rotation Manager (`AiRotationManager`)**: Extract the API key selection, status tracking (rate-limited/invalid), and model cooldown logic out of the provider.
2. **JSON Parser & Coercion Service (`JsonParserService`)**: Centralize and strengthen JSON sanitization, parsing, and schema coercion with rigorous edge-case unit testing.
3. **Strict Type Safety in Adapters**: Refactor repositories to replace all `any` usages with typed Drizzle queries and clean DTO mappers.
4. **Stale Job Reclamation (Heartbeat Worker)**: Add a periodic task to find background jobs stuck in the `running` state for too long and safely re-queue or fail them.

## User Stories

1. As a learner, I want my lesson analysis to continue seamlessly even if one API key or model gets rate-limited, so that my learning progress is never interrupted.
2. As a learner, I want my exercise attempts to be graded successfully even if the AI response contains unexpected formatting characters, so that I get my feedback immediately.
3. As a developer, I want full TypeScript type safety when interacting with the database, so that database schema changes are caught at compile-time instead of runtime.
4. As a learner, I want my lesson generation to automatically resume if the background server temporarily restarts, so that I don't have to manually re-submit my text.

## Implementation Decisions

### 1. AI Rotation Manager

- Create a dedicated domain component `AiRotationManager` responsible for checking API key health, applying cooldowns, and rotating models.
- The `GeminiLLMProvider` will delegate key/model selection to the `AiRotationManager` rather than querying repositories and state directly.
- Keeps cooldown state in memory (or Redis) and persists key state changes via the `KeyResolver` port.

### 2. JSON Parser & Coercion Service

- Create `JsonParserService` that consolidates JSON extraction from Markdown code blocks, string cleaning (escaping newlines/tabs inside string fields), and Zod schema coercion.
- The new service will coerce and normalize various structures (e.g. empty strings, nulls, nested arrays) before sending them to the Zod schema parser.
- Ensure the repair loop uses this parser for the corrected responses as well.

### 3. Strict Type Safety in Adapters

- Replace all `any` references in `src/domain/memory/adapters/drizzle-repositories.ts` and `src/domain/lesson/adapters/drizzle-repositories.ts` with explicit type annotations.
- Bind the transaction coordinator to the actual `PgTransaction` client type from Drizzle instead of a generic DB client.
- Map database row structures to domain aggregates using strict converter functions.

### 4. Background Job Recovery

- Introduce a stale job recovery script (reclamation worker) that runs periodically (e.g. every 5 minutes).
- The worker will look for Postgres jobs with `status = 'running'` that have not updated their `lockedAt` timestamp within the last 10 minutes.
- Stale jobs will be unlocked (`status = 'failed'` or re-queued back to `status = 'queued'`) so they can be retried by active worker daemons.

## Testing Decisions

- **Clean Parsing Tests**: We will write comprehensive unit tests for `JsonParserService` using mock raw string outputs containing trailing commas, double-escaped quotes, inline newlines, and malformed arrays to ensure the parser handles them without throwing unhandled exceptions.
- **Rotation Isolation Tests**: We will write unit tests for `AiRotationManager` verifying that when one model returns a rate limit error, it is properly cooled down and the next available model is selected.
- **Stale Job Integration Tests**: We will mock a running job, artificially set its `lockedAt` to 1 hour ago, run the reclamation script, and verify that the job is correctly re-queued or failed.

## Out of Scope

- Modifying the public Next.js page layouts or introducing new visual UI screens (except for admin logging visibility if needed).
- Changing database schemas or migrating from Postgres/Drizzle to another database engine.
- Modifying how spaced repetition intervals are calculated.
