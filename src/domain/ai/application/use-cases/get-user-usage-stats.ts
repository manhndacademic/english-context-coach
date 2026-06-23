import type { UsageRepository } from "../ports/usage-repository";
import type { UsageTimeframe, UsageStats } from "../../domain/types";
import type { DbClient } from "@/db";

export interface GetUserUsageStatsUseCase {
  execute(
    userId: string,
    timeframe: UsageTimeframe,
    dbClient?: DbClient
  ): Promise<UsageStats>;
}

export class GetUserUsageStatsService implements GetUserUsageStatsUseCase {
  constructor(private readonly usageRepo: UsageRepository) {}

  async execute(
    userId: string,
    timeframe: UsageTimeframe,
    dbClient?: DbClient
  ): Promise<UsageStats> {
    return this.usageRepo.getUserUsageStats(userId, timeframe, dbClient);
  }
}

export function createGetUserUsageStatsUseCase(
  usageRepo: UsageRepository
): GetUserUsageStatsUseCase {
  return new GetUserUsageStatsService(usageRepo);
}
