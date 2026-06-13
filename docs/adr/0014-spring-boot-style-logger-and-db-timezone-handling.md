# Spring Boot-Style Logger and DB Timezone Handling

To make background worker logs, request lifecycles, and queue delays easy to debug, we decided to implement a custom, zero-dependency Logger utility alongside an automated timezone correction helper for database timestamp metrics.

## Context and Problem

As the application moved towards a queue-based background worker architecture (processing Lessons and Spaced Repetition reviews), understanding execution states became difficult. We needed to log:
1. When background jobs are claimed.
2. How long jobs wait in the database queue (Queue Latency).
3. How long each processing stage takes (e.g. analysis, exercises, review prompts).
4. Total job lifetimes.

Using standard `console.log` statements produced inconsistent outputs, making grep/parse operations challenging. Additionally, PostgreSQL's `timestamp` (without time zone) columns default to UTC when written by PostgreSQL's `now()` or `defaultNow()`, but node-postgres parses them into JavaScript `Date` objects using the local runtime timezone. In local development environments in Vietnam (GMT+7), this caused a 7-hour timezone offset skew, incorrectly reporting queue times of ~7 hours instead of a few seconds.

## Decisions

We made the following architectural decisions:

1. **Zero-Dependency Spring Boot-Style Logger**: Created a custom `Logger` class in `src/lib/logger.ts` that prints structured logs mimicking Spring Boot:
   `YYYY-MM-DD HH:mm:ss.SSS  LEVEL PID --- [  ThreadName] LoggerName : Message`
   - **Performance**: Avoided massive logging frameworks (like Winston or Pino) to prevent runtime package footprint and keep startup time minimal.
   - **TTY Color Support**: Built-in support for ANSI colors (Green for `INFO`, Yellow for `WARN`, Red for `ERROR`) that automatically disable in production/file-logged environments.

2. **In-Memory Timezone Correction (`parseDbDate`)**: Added a helper function to translate date values retrieved from PostgreSQL `timestamp` columns:
   ```typescript
   export function parseDbDate(dateVal: unknown): Date | null {
     if (!dateVal) return null;
     const d = new Date(dateVal as any);
     if (isNaN(d.getTime())) return null;

     return new Date(Date.UTC(
       d.getFullYear(),
       d.getMonth(),
       d.getDate(),
       d.getHours(),
       d.getMinutes(),
       d.getSeconds(),
       d.getMilliseconds()
     ));
   }
   ```
   This treats the local components of the incorrectly parsed date as UTC components, returning the correct absolute epoch representation of database timestamps without requiring database schema migrations.

## Considered Options

- **Winston / Pino Logging Frameworks**: Rejected to keep the dependency footprint small and execution overhead low.
- **Postgres Column Migration (`timestamptz`)**: Converting `timestamp` columns to `timestamp with time zone`. While database-native, running this migration against existing tables could cause database locks and requires writing/testing database migrations. We opted for JS-level runtime correction (`parseDbDate`) as a low-risk, easily reversible alternative.
