import type { UsageRepository } from "../ports/usage-repository";
import type { UsageTimeframe, UsageStats } from "../../domain/types";

export interface GetUserUsageStatsUseCase {
  execute(userId: string, timeframe: UsageTimeframe): Promise<UsageStats>;
}

export class GetUserUsageStatsService implements GetUserUsageStatsUseCase {
  constructor(private readonly usageRepo: UsageRepository) {}

  async execute(
    userId: string,
    timeframe: UsageTimeframe
  ): Promise<UsageStats> {
    return this.usageRepo.getUserUsageStats(userId, timeframe);
  }
}
