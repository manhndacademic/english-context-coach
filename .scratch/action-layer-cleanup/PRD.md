Status: ready-for-agent

# PRD: Action Layer Cleanup

Business logic, raw database queries, and duplicate code are accumulating in `app/actions/`. The goal of this PRD is to slim down the action layer — leaving each action responsible only for validating input, delegating to the domain layer, and revalidating the path.

## Problem Statement

Action files (`settings.ts`, `review.ts`, `source-texts.ts`) are currently doing too much:

1. **`settings.ts` is an unacknowledged repository**: 7 out of 8 actions run raw Drizzle queries directly. The business rule `MAX_USER_KEYS = 10`, deduplication logic using a SHA-256 fingerprint, multi-step orchestration (fetch → decrypt → verify → update status), and a 120-line analytics function all live inside the action file. There is no `UserApiKeyRepository` or `UsageRepository`.

2. **`getMistakePatternLessonsMap` is a misplaced raw SQL query**: This is not a server action, has no validation, and contains a raw Drizzle join + in-memory grouping loop directly within `review.ts`. This logic belongs in `MistakePatternRepository`.

3. **Duplicate server action**: `retryExercisesAction` and `retryLessonGenerationAction` in `source-texts.ts` are byte-for-byte identical — sharing the same schema and handler body.

4. **`LessonRepository` god-interface at injection sites**: `DefaultLessonGenerationEngine` accepts the full 21-method composite `LessonRepository` but only uses a small fraction. Sub-interfaces are already defined in `ports.ts` but are not used at the injection sites.

5. **`lesson/index.ts` re-exports concrete classes**: `DrizzleLessonRepository`, `GeminiGenerationEngine`, and `DefaultLessonGenerationEngine` are exported from the domain index, violating port/adapter separation.

Consequence: the action layer cannot be tested in isolation, changing business rules requires edits in multiple places, and callers might couple to concrete implementations instead of interfaces.

## Solution

Slim down the action layer by:

- Extracting the `UserApiKeyRepository` port with a Drizzle adapter — absorbing all CRUD operations for user API keys.
- Extracting the `UsageRepository` port — absorbing analytics queries from `getUsageStatsAction`.
- Moving the `getMistakePatternLessonsMap` query into `MistakePatternRepository` (established in PRD 1).
- Deleting `retryExercisesAction` (duplicate).
- Narrowing the injection sites of `DefaultLessonGenerationEngine` from the composite `LessonRepository` to focused sub-interfaces.
- Removing concrete class exports from `lesson/index.ts`.

## User Stories

1. As a developer, I want `addUserApiKeyAction` to delegate duplicate-checking and encryption orchestration to a `UserApiKeyService` or repository method, so that the action only handles input validation and auth.
2. As a developer, I want `MAX_USER_KEYS` business rule to be defined inside the domain service, not as a module-level constant in an action file, so that the rule is enforced in one place.
3. As a developer, I want `enableUserApiKeyAction` and `reverifyUserApiKeyAction` to call a single domain method (e.g., `userApiKeyService.verifyAndActivate(keyId, userId)`), so that the fetch → decrypt → verify → update status orchestration lives in the domain.
4. As a developer, I want `getUsageStatsAction` to call a `UsageRepository.getUserUsageStats(userId, timeframe)` method, so that the date arithmetic, DB queries, and daily gap-filling logic are outside the action handler.
5. As a developer, I want `getMistakePatternLessonsMap` to be a method on `MistakePatternRepository`, so that the action layer does not contain raw Drizzle joins.
6. As a developer, I want `review.ts` to call `mistakePatternRepository.getLessonsForPatterns(userId)` instead of running a raw DB query, so that the action file is a thin delegate.
7. As a developer, I want `retryExercisesAction` to be deleted and its call sites updated to use `retryLessonGenerationAction`, so that there is one canonical retry action.
8. As a developer, I want `DefaultLessonGenerationEngine` constructor to accept `SourceTextRepository`, `LessonContentRepository`, `GenerationJobRepository`, `GenerationProgressRepository`, and `LessonTransactionRepository` as separate parameters instead of the full `LessonRepository`, so that callers declare exactly what the engine needs.
9. As a developer, I want the `DrizzleLessonRepository` instance to be passed at each narrower parameter type at the factory site, so that the injection change is backward-compatible without changing the adapter.
10. As a developer, I want `lesson/index.ts` to export only factory functions and port interfaces, so that callers cannot accidentally couple to concrete adapter classes.
11. As a developer, I want `DrizzleLessonRepository`, `GeminiGenerationEngine`, and `DefaultLessonGenerationEngine` to remain importable from their adapter paths for test setup purposes, so that removing them from the index does not break test wiring.
12. As a developer, I want `deleteUserApiKeyAction` to call a single `userApiKeyService.delete(keyId, userId)` method, so that the action contains no Drizzle statements.
13. As a developer, I want `disableUserApiKeyAction` to call `userApiKeyService.disable(keyId, userId)`, so that the status-transition logic is in the domain.
14. As a developer, I want all `UserApiKey` CRUD operations to be testable through the `UserApiKeyRepository` port interface using an in-memory adapter, so that tests do not require a running Postgres instance.
15. As a developer, I want `UsageRepository.getUserUsageStats()` to return a typed result shape, so that TypeScript catches mismatches between the analytics query and the action's return value.
16. As a developer, I want the `admin-keys.ts` actions for system API keys to delegate to a `SystemApiKeyRepository` or service, so that the fetch → decrypt → verify → update pattern is not duplicated between user and system key management.
17. As a developer, I want `validatedAction` user parameter to be typed as `SessionUser` instead of `any`, so that handlers get compile-time safety on the user object.
18. As a developer, I want existing tests for `LessonGenerationEngine` to pass with no behavior changes after the constructor parameter narrowing, so that the narrowing is a pure refactor.
19. As a developer, I want `MistakePatternRepository.getLessonsForPatterns(userId)` to return the same shape as the current `getMistakePatternLessonsMap` function, so that the UI component using the result does not change.
20. As a developer, I want the tightened `SessionUser` type on `validatedAction` to be the same type returned by `requireUser()` and `requireAdmin()`, so that no casting is required at any call site.

## Implementation Decisions

### New port: `UserApiKeyRepository`

A new port interface `UserApiKeyRepository` will be defined in the `domain/ai` area (or a new `domain/user-settings` area if preferred). It will include methods for: `add(userId, data)`, `delete(userId, keyId)`, `disable(userId, keyId)`, `enable(userId, keyId)`, `reverify(userId, keyId)`, `findById(userId, keyId)`, `countForUser(userId)`, `checkDuplicate(userId, fingerprint)`. The `DrizzleUserApiKeyRepository` adapter will implement this using the existing Drizzle schema.

### New port: `UsageRepository` (or fold into existing admin metrics)

`getUsageStatsAction` contains three Drizzle queries (summary aggregate, daily breakdown, recent rows) plus date arithmetic and gap-filling. These will be extracted into `UsageRepository.getUserUsageStats(userId, timeframe)`. The existing `lib/admin-metrics.ts` may be a natural home, or a new `domain/usage` module.

### `MistakePatternRepository.getLessonsForPatterns()`

A new method added to `MistakePatternRepository` port (and implemented in `DrizzleMistakePatternRepository`):

```typescript
getLessonsForPatterns(userId: string): Promise<
  Record<string, Array<{ id: string; title: string | null }>>
>
```

The join logic and in-memory grouping from `getMistakePatternLessonsMap` moves here verbatim. The action becomes a one-liner delegate.

### Constructor narrowing for `DefaultLessonGenerationEngine`

The constructor signature changes from:

```typescript
constructor(lessons: LessonRepository, genEngine: GenerationEngine, textProcessor: TextProcessor)
```

to:

```typescript
constructor(
  sourceTexts: SourceTextRepository,
  lessonContent: LessonContentRepository,
  jobs: GenerationJobRepository,
  progress: GenerationProgressRepository,
  tx: LessonTransactionRepository,
  genEngine: GenerationEngine,
  textProcessor: TextProcessor
)
```

The factory function in `lesson/index.ts` passes the single `DrizzleLessonRepository` instance at each parameter — since it satisfies all five sub-interfaces, no new adapter is needed.

### `lesson/index.ts` concrete class export removal

`DrizzleLessonRepository`, `GeminiGenerationEngine`, and `DefaultLessonGenerationEngine` will be removed from the `lesson/index.ts` barrel. Any test files that import these directly will update their import paths to the adapter subdirectory.

### `validatedAction` type tightening

The `user: any` parameter in `validatedAction`'s handler signature will be replaced with `SessionUser` — the return type of `requireUser()`. No runtime behavior changes.

### `retryExercisesAction` deletion

`retryExercisesAction` will be deleted. All call sites will be updated to use `retryLessonGenerationAction` which has identical behavior. A grep for `retryExercisesAction` across the codebase will identify all import sites.

### Deferred: `validatedAction` JSON input support

Extending `validatedAction` to accept plain objects (not just FormData) is noted in the audit but deferred out of scope for this PRD.

### Deferred: BullMQ queue factory

Collapsing `queue.ts`, `digestQueue.ts`, `reclaimQueue.ts` boilerplate into a `makeQueue` factory is deferred — very low risk and very low impact.

### No schema changes

No database schema changes required.

## Testing Decisions

### What makes a good test here

Tests should verify that an action produces the correct result given valid input, without knowing whether it used a repository or called DB directly. For the new repositories, tests should assert on the return value of the port method — not on internal SQL structure.

### Modules to test

- `UserApiKeyRepository` Drizzle adapter — add/delete/disable/enable/reverify operations, using PGLite as the local-substitutable test stand-in
- `UsageRepository.getUserUsageStats()` — verify aggregation and gap-filling return the correct shape for the three timeframes
- `MistakePatternRepository.getLessonsForPatterns()` — verify grouping logic matches current behavior (extend existing `drizzle-repositories.test.ts`)
- `LessonGenerationEngine` — existing tests should pass unchanged; the constructor narrowing is a type-level change only

### Prior art

- `src/app/actions/attempts.ts` — the gold-standard shape for a clean action: validate → delegate → revalidate path; all new actions should match this shape
- `src/domain/memory/adapters/drizzle-repositories.test.ts` — PGLite-based adapter tests; follow this pattern for `UserApiKeyRepository` adapter tests
- `src/lib/admin-metrics.test.ts` — if it exists, follow for `UsageRepository` tests

## Out of Scope

- Full extraction of `SystemApiKeyRepository` for admin key management (`admin-keys.ts`) — noted as a follow-up
- `MistakePatternRepository.getDashboardMetrics()` interface simplification — tracked separately
- Any UI changes
- Splitting `DrizzleLessonRepository` into 5 smaller adapter classes
- BullMQ `makeQueue` factory
- `validatedAction` JSON input mode
- `trigger.ts` circular dependency fix

## Further Notes

PRD 2 should be executed **after** PRD 1 is merged, because PRD 1 may add new methods to `MistakePatternRepository` that this PRD also extends. Merging in order prevents conflicts.

The `saveUserApiKeyAction` in `settings.ts` (the legacy multi-key format) and the newer `addUserApiKeyAction` overlap in purpose. The legacy action should be evaluated for removal during implementation — if no call sites remain after the migration, it can be deleted.

All Vietnamese error messages in the actions should be preserved verbatim during the extraction to repository/service methods.
