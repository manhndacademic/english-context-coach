Status: ready-for-agent

## Parent

[.scratch/action-layer-cleanup/PRD.md](../PRD.md)

## What to build

Extract the analytics logic from `getUsageStatsAction` in `app/actions/settings.ts` into a `UsageRepository` port.

Define a `UsageRepository` port interface with a method `getUserUsageStats(userId: string, timeframe: Timeframe): Promise<UsageStats>`, where `UsageStats` is a typed result shape covering the summary aggregate, daily breakdown, and recent rows currently computed in the action.

Implement `DrizzleUsageRepository` (a natural home could be `lib/admin-metrics.ts` or a new `domain/usage/` module — prefer wherever existing usage-query code already lives). The implementation absorbs the three Drizzle queries, date arithmetic, and daily gap-filling logic from the action.

Refactor `getUsageStatsAction` to call `usageRepository.getUserUsageStats(userId, timeframe)` — the action becomes a one-liner delegate.

`UsageStats` must be a typed return shape so TypeScript catches mismatches between the query and the action's response.

## Acceptance criteria

- [ ] `UsageRepository` port is defined with `getUserUsageStats(userId, timeframe)` returning a typed `UsageStats`
- [ ] `DrizzleUsageRepository` implements the port; contains all date arithmetic, gap-filling, and Drizzle queries
- [ ] `getUsageStatsAction` contains no raw Drizzle statements; it is a thin validate → delegate → revalidate handler
- [ ] `UsageStats` type is typed; TypeScript catches shape mismatches at compile-time
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes

## Blocked by

None — can start immediately
