import { sql, desc, and, eq, gt, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { computeActiveUserCount } from "@/lib/admin-metrics";
import { getApiKeyRotationPool } from "@/domain/ai";
import { AdminMetricsRepository } from "../ports";

export class DrizzleAdminMetricsRepository implements AdminMetricsRepository {
  constructor(private readonly dbClient = db) {}

  async getOverallAiStats() {
    const [result] = await this.dbClient
      .select({
        totalCount: sql<number>`count(*)::int`,
        successCount: sql<number>`sum(case when status = 'succeeded' then 1 else 0 end)::int`,
        totalInputTokens: sql<number>`sum(coalesce(input_tokens, 0))::int`,
        totalOutputTokens: sql<number>`sum(coalesce(output_tokens, 0))::int`,
        totalCostMicros: sql<number>`sum(coalesce(cost_micros, 0))::int`,
        avgLatency: sql<number>`avg(case when status = 'succeeded' then latency_ms else null end)::int`,
      })
      .from(schema.aiRequests);

    return {
      totalCount: result?.totalCount ?? 0,
      successCount: result?.successCount ?? 0,
      totalInputTokens: result?.totalInputTokens ?? 0,
      totalOutputTokens: result?.totalOutputTokens ?? 0,
      totalCostMicros: result?.totalCostMicros ?? 0,
      avgLatency: result?.avgLatency ?? 0,
    };
  }

  async getDailyAiMetrics(limit: number) {
    return this.dbClient
      .select({
        date: sql<string>`to_char(created_at, 'YYYY-MM-DD')`,
        requests: sql<number>`count(*)::int`,
        cost: sql<number>`sum(coalesce(cost_micros, 0))::int`,
        tokens: sql<number>`sum(coalesce(input_tokens, 0) + coalesce(output_tokens, 0))::int`,
      })
      .from(schema.aiRequests)
      .groupBy(sql`to_char(created_at, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(created_at, 'YYYY-MM-DD') desc`)
      .limit(limit);
  }

  async getAiStatsByModel() {
    return this.dbClient
      .select({
        model: schema.aiRequests.model,
        requests: sql<number>`count(*)::int`,
        tokens: sql<number>`sum(coalesce(input_tokens, 0) + coalesce(output_tokens, 0))::int`,
        costMicros: sql<number>`sum(coalesce(cost_micros, 0))::int`,
      })
      .from(schema.aiRequests)
      .groupBy(schema.aiRequests.model);
  }

  async getAiStatsByPurpose() {
    return this.dbClient
      .select({
        purpose: schema.aiRequests.purpose,
        requests: sql<number>`count(*)::int`,
        tokens: sql<number>`sum(coalesce(input_tokens, 0) + coalesce(output_tokens, 0))::int`,
      })
      .from(schema.aiRequests)
      .groupBy(schema.aiRequests.purpose);
  }

  async getApiKeysStatusCounts() {
    const [result] = await this.dbClient
      .select({
        active: sql<number>`sum(case when status = 'active' then 1 else 0 end)::int`,
        rateLimited: sql<number>`sum(case when status = 'rate_limited' then 1 else 0 end)::int`,
        invalid: sql<number>`sum(case when status = 'invalid' then 1 else 0 end)::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(schema.aiApiKeys);

    const dbActive = result?.active ?? 0;
    const dbRateLimited = result?.rateLimited ?? 0;
    const dbInvalid = result?.invalid ?? 0;
    const dbTotal = result?.total ?? 0;

    const envKeysStats = getApiKeyRotationPool().getEnvKeysStatus();

    return {
      active: dbActive + envKeysStats.active,
      rateLimited: dbRateLimited + envKeysStats.rateLimited,
      invalid: dbInvalid + envKeysStats.invalid,
      total: dbTotal + envKeysStats.total,
    };
  }

  async getActiveUserCount(since: Date): Promise<number> {
    const [ai, attempts, reviews] = await Promise.all([
      this.dbClient
        .select({ userId: schema.aiRequests.userId })
        .from(schema.aiRequests)
        .where(
          and(
            gt(schema.aiRequests.createdAt, since),
            sql`${schema.aiRequests.userId} is not null`
          )
        ),
      this.dbClient
        .select({ userId: schema.attempts.userId })
        .from(schema.attempts)
        .where(gt(schema.attempts.createdAt, since)),
      this.dbClient
        .select({ userId: schema.reviewAttempts.userId })
        .from(schema.reviewAttempts)
        .where(gt(schema.reviewAttempts.createdAt, since)),
    ]);

    return computeActiveUserCount(ai, attempts, reviews);
  }

  async getAiErrorStats24h(since: Date) {
    const [result] = await this.dbClient
      .select({
        total: sql<number>`count(*)::int`,
        failed: sql<number>`sum(case when status = 'failed' then 1 else 0 end)::int`,
      })
      .from(schema.aiRequests)
      .where(gt(schema.aiRequests.createdAt, since));

    return {
      total: result?.total ?? 0,
      failed: result?.failed ?? 0,
    };
  }

  async getDigestStatsByDate(digestDate: string) {
    const [[logs], [enabled]] = await Promise.all([
      this.dbClient
        .select({
          sent: sql<number>`sum(case when status = 'sent' then 1 else 0 end)::int`,
          skipped: sql<number>`sum(case when status = 'skipped' then 1 else 0 end)::int`,
          failed: sql<number>`sum(case when status = 'failed' then 1 else 0 end)::int`,
        })
        .from(schema.emailDigestLogs)
        .where(eq(schema.emailDigestLogs.digestDate, digestDate)),
      this.dbClient
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.users)
        .where(eq(schema.users.emailDigestEnabled, true)),
    ]);

    return {
      sent: logs?.sent ?? 0,
      skipped: logs?.skipped ?? 0,
      failed: logs?.failed ?? 0,
      enabledUsers: enabled?.total ?? 0,
    };
  }

  async getTopUsersByResourceUsage(limit: number) {
    const keyCountsSubquery = this.dbClient
      .select({
        userId: schema.userAiApiKeys.userId,
        personalKeyCount: sql<number>`count(*)::int`.as("personal_key_count"),
        activePersonalKeyCount:
          sql<number>`count(case when ${schema.userAiApiKeys.status} = 'active' then 1 end)::int`.as(
            "active_personal_key_count"
          ),
      })
      .from(schema.userAiApiKeys)
      .groupBy(schema.userAiApiKeys.userId)
      .as("keys_subquery");

    return this.dbClient
      .select({
        userId: schema.aiRequests.userId,
        email: schema.users.email,
        personalKeyCount: sql<number>`coalesce(${keyCountsSubquery.personalKeyCount}, 0)::int`,
        activePersonalKeyCount: sql<number>`coalesce(${keyCountsSubquery.activePersonalKeyCount}, 0)::int`,
        totalRequests: sql<number>`count(${schema.aiRequests.id})::int`,
        totalTokens: sql<number>`sum(coalesce(${schema.aiRequests.inputTokens}, 0) + coalesce(${schema.aiRequests.outputTokens}, 0))::int`,
        totalCostUsd: sql<number>`sum(coalesce(${schema.aiRequests.costMicros}, 0))::double precision / 1000000`,
      })
      .from(schema.aiRequests)
      .leftJoin(schema.users, eq(schema.aiRequests.userId, schema.users.id))
      .leftJoin(
        keyCountsSubquery,
        eq(schema.aiRequests.userId, keyCountsSubquery.userId)
      )
      .groupBy(
        schema.aiRequests.userId,
        schema.users.email,
        keyCountsSubquery.personalKeyCount,
        keyCountsSubquery.activePersonalKeyCount
      )
      .orderBy(desc(sql`sum(coalesce(${schema.aiRequests.costMicros}, 0))`))
      .limit(limit);
  }

  async getJobStatusBreakdown() {
    return this.dbClient
      .select({
        status: schema.generationJobs.status,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.generationJobs)
      .groupBy(schema.generationJobs.status);
  }

  async getActiveAndFailedJobs(limit: number) {
    return this.dbClient
      .select({
        id: schema.generationJobs.id,
        userId: schema.generationJobs.userId,
        email: schema.users.email,
        status: schema.generationJobs.status,
        stage: schema.generationJobs.stage,
        attempts: schema.generationJobs.attempts,
        errorMessage: schema.generationJobs.errorMessage,
        createdAt: schema.generationJobs.createdAt,
      })
      .from(schema.generationJobs)
      .leftJoin(schema.users, eq(schema.generationJobs.userId, schema.users.id))
      .where(
        inArray(schema.generationJobs.status, ["queued", "running", "failed"])
      )
      .orderBy(desc(schema.generationJobs.createdAt))
      .limit(limit);
  }
}
