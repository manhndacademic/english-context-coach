import { type DbClient } from "@/db";
import type { UsageTimeframe, UsageStats } from "../../domain/types";

export interface UsageRepository {
  getUserUsageStats(
    userId: string,
    timeframe: UsageTimeframe,
    dbClient?: DbClient
  ): Promise<UsageStats>;
}
