import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db, schema, type DbClient } from "@/db";

export type UsageTimeframe = "today" | "7days" | "30days";

export interface UsageStats {
  summary: {
    totalRequests: number;
    successRate: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    avgLatencySec: number;
    personalKeys: {
      total: number;
      active: number;
      invalid: number;
      rateLimited: number;
    };
  };
  daily: Array<{
    date: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
  }>;
  recent: Array<{
    id: string;
    purpose: string;
    model: string;
    status: string;
    latencyMs: number | null;
    errorMessage: string | null;
    createdAt: Date;
  }>;
}

export interface UsageRepository {
  getUserUsageStats(
    userId: string,
    timeframe: UsageTimeframe
  ): Promise<UsageStats>;
}

export class DrizzleUsageRepository implements UsageRepository {
  constructor(private dbClient: DbClient = db) {}

  async getUserUsageStats(
    userId: string,
    timeframe: UsageTimeframe
  ): Promise<UsageStats> {
    const now = new Date();
    let since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (timeframe === "today") {
      since = new Date(now);
      since.setHours(0, 0, 0, 0);
    } else if (timeframe === "30days") {
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const [summaryResult] = await this.dbClient
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

    const dailyDb = await this.dbClient
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

    const daysCount =
      timeframe === "today" ? 1 : timeframe === "7days" ? 7 : 30;
    const dailyMap = new Map(dailyDb.map((row) => [row.dateStr, row]));
    const daily: UsageStats["daily"] = [];
    for (let i = daysCount - 1; i >= 0; i -= 1) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const date = day.toISOString().split("T")[0];
      const match = dailyMap.get(date);
      daily.push({
        date,
        requests: match?.requests ?? 0,
        inputTokens: match?.inputTokens ?? 0,
        outputTokens: match?.outputTokens ?? 0,
      });
    }

    const recent = await this.dbClient
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

    const [keyCounts] = await this.dbClient
      .select({
        active: sql<number>`sum(case when status = 'active' then 1 else 0 end)::int`,
        invalid: sql<number>`sum(case when status = 'invalid' then 1 else 0 end)::int`,
        rateLimited: sql<number>`sum(case when status = 'rate_limited' then 1 else 0 end)::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(schema.userAiApiKeys)
      .where(eq(schema.userAiApiKeys.userId, userId));

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
}
