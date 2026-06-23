import { and, desc, eq, gt, sql } from "drizzle-orm";
import { subDays, startOfDay, format } from "date-fns";
import { db, schema, type DbClient } from "@/db";
import type { UsageRepository } from "../../application/ports/usage-repository";
import type { UsageTimeframe, UsageStats } from "../../domain/types";

export class DrizzleUsageRepository implements UsageRepository {
  async getUserUsageStats(
    userId: string,
    timeframe: UsageTimeframe,
    dbClient: DbClient = db
  ): Promise<UsageStats> {
    const now = new Date();
    const since = this.getSinceDate(timeframe, now);

    const [[summaryResult], dailyDb, recent, [keyCounts]] = await Promise.all([
      this.fetchSummary(dbClient, userId, since),
      this.fetchDailyStats(dbClient, userId, since),
      this.fetchRecentRequests(dbClient, userId),
      this.fetchKeyCounts(dbClient, userId),
    ]);

    const daily = this.formatDailyStats(dailyDb, timeframe, now);

    const totalRequests = summaryResult?.totalRequests ?? 0;
    const succeededRequests = summaryResult?.succeededRequests ?? 0;
    const totalInputTokens = summaryResult?.totalInputTokens ?? 0;
    const totalOutputTokens = summaryResult?.totalOutputTokens ?? 0;

    return {
      summary: {
        totalRequests,
        successRate:
          totalRequests > 0
            ? Math.round((succeededRequests / totalRequests) * 100)
            : 100,
        totalTokens: totalInputTokens + totalOutputTokens,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        avgLatencySec: summaryResult?.avgLatencyMs
          ? parseFloat((summaryResult.avgLatencyMs / 1000).toFixed(1))
          : 0,
        personalKeys: {
          total: keyCounts?.total ?? 0,
          active: keyCounts?.active ?? 0,
          invalid: keyCounts?.invalid ?? 0,
          rateLimited: keyCounts?.rateLimited ?? 0,
        },
      },
      daily,
      recent,
    };
  }

  private getSinceDate(timeframe: UsageTimeframe, now: Date): Date {
    if (timeframe === "today") {
      return startOfDay(now);
    }
    if (timeframe === "30days") {
      return subDays(now, 30);
    }
    return subDays(now, 7);
  }

  private async fetchSummary(dbClient: DbClient, userId: string, since: Date) {
    return dbClient
      .select({
        totalRequests: sql<number>`count(*)::int`,
        succeededRequests: sql<number>`sum(case when status = 'succeeded' then 1 else 0 end)::int`,
        totalInputTokens: sql<number>`sum(coalesce(input_tokens, 0))::int`,
        totalOutputTokens: sql<number>`sum(coalesce(output_tokens, 0))::int`,
        avgLatencyMs: sql<number>`avg(case when status = 'succeeded' then latency_ms else null end)::int`,
      })
      .from(schema.aiRequests)
      .where(
        and(
          eq(schema.aiRequests.userId, userId),
          gt(schema.aiRequests.createdAt, since)
        )
      );
  }

  private async fetchDailyStats(
    dbClient: DbClient,
    userId: string,
    since: Date
  ) {
    return dbClient
      .select({
        dateStr: sql<string>`to_char(created_at, 'YYYY-MM-DD')`,
        requests: sql<number>`count(*)::int`,
        inputTokens: sql<number>`sum(coalesce(input_tokens, 0))::int`,
        outputTokens: sql<number>`sum(coalesce(output_tokens, 0))::int`,
      })
      .from(schema.aiRequests)
      .where(
        and(
          eq(schema.aiRequests.userId, userId),
          gt(schema.aiRequests.createdAt, since)
        )
      )
      .groupBy(sql`to_char(created_at, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(created_at, 'YYYY-MM-DD') asc`);
  }

  private async fetchRecentRequests(dbClient: DbClient, userId: string) {
    return dbClient
      .select({
        id: schema.aiRequests.id,
        purpose: schema.aiRequests.purpose,
        model: schema.aiRequests.model,
        status: schema.aiRequests.status,
        latencyMs: schema.aiRequests.latencyMs,
        errorMessage: schema.aiRequests.errorMessage,
        createdAt: schema.aiRequests.createdAt,
      })
      .from(schema.aiRequests)
      .where(eq(schema.aiRequests.userId, userId))
      .orderBy(desc(schema.aiRequests.createdAt))
      .limit(5);
  }

  private async fetchKeyCounts(dbClient: DbClient, userId: string) {
    return dbClient
      .select({
        active: sql<number>`sum(case when status = 'active' then 1 else 0 end)::int`,
        invalid: sql<number>`sum(case when status = 'invalid' then 1 else 0 end)::int`,
        rateLimited: sql<number>`sum(case when status = 'rate_limited' then 1 else 0 end)::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(schema.userAiApiKeys)
      .where(eq(schema.userAiApiKeys.userId, userId));
  }

  private formatDailyStats(
    dailyDb: Array<{
      dateStr: string;
      requests: number;
      inputTokens: number;
      outputTokens: number;
    }>,
    timeframe: UsageTimeframe,
    now: Date
  ): UsageStats["daily"] {
    const timeframeDays: Record<UsageTimeframe, number> = {
      today: 1,
      "7days": 7,
      "30days": 30,
    };
    const daysCount = timeframeDays[timeframe];
    const dailyMap = new Map(dailyDb.map((row) => [row.dateStr, row]));
    const daily: UsageStats["daily"] = [];

    for (let i = daysCount - 1; i >= 0; i -= 1) {
      const day = subDays(now, i);
      const date = format(day, "yyyy-MM-dd");
      const match = dailyMap.get(date);
      daily.push({
        date,
        requests: match?.requests ?? 0,
        inputTokens: match?.inputTokens ?? 0,
        outputTokens: match?.outputTokens ?? 0,
      });
    }

    return daily;
  }
}
