"use server";

import { revalidatePath } from "next/cache";
import { getKeyResolver } from "@/domain/ai";
import { encryptApiKey } from "@/lib/crypto";
import { validatedAction } from "@/lib/action-builder";
import { requireUser } from "@/lib/auth/guards";
import { GoogleGenAI } from "@google/genai";
import { db, schema } from "@/db";
import { and, eq, gt, sql, desc } from "drizzle-orm";
import { z } from "zod";

const saveUserApiKeySchema = z.object({
  apiKey: z.string().trim(),
});

export const saveUserApiKeyAction = validatedAction(
  saveUserApiKeySchema,
  async (data, user) => {
    let encryptedKey: string | null = null;
    if (data.apiKey) {
      const rawKeys = data.apiKey
        .split(/[,\n]+/)
        .map((k) => k.trim())
        .filter(Boolean);

      if (rawKeys.length > 0) {
        try {
          // Validate each key in parallel
          await Promise.all(
            rawKeys.map(async (key) => {
              const ai = new GoogleGenAI({ apiKey: key });
              await ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: "ping",
              });
            })
          );
        } catch (e: any) {
          return {
            error: `Xác thực API Key thất bại: ${e.message || e}`,
          } as any;
        }
        const encryptedKeys = rawKeys.map((k) => encryptApiKey(k));
        encryptedKey = JSON.stringify(encryptedKeys);
      }
    }

    await getKeyResolver().saveUserApiKey(user.id, encryptedKey);

    revalidatePath("/settings");
    return { success: true } as any;
  }
);

export async function getUsageStatsAction(
  timeframe: "today" | "7days" | "30days"
) {
  const user = await requireUser();

  const now = new Date();
  let since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // default 7 days
  if (timeframe === "today") {
    since = new Date(now);
    since.setHours(0, 0, 0, 0);
  } else if (timeframe === "30days") {
    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // 1. Summary stats
  const [summaryResult] = await db
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
        eq(schema.aiRequests.userId, user.id),
        gt(schema.aiRequests.createdAt, since)
      )
    );

  const totalRequests = summaryResult?.totalRequests ?? 0;
  const succeededRequests = summaryResult?.succeededRequests ?? 0;
  const successRate =
    totalRequests > 0
      ? Math.round((succeededRequests / totalRequests) * 100)
      : 100;
  const totalInputTokens = summaryResult?.totalInputTokens ?? 0;
  const totalOutputTokens = summaryResult?.totalOutputTokens ?? 0;
  const totalTokens = totalInputTokens + totalOutputTokens;
  const avgLatencySec = summaryResult?.avgLatencyMs
    ? parseFloat((summaryResult.avgLatencyMs / 1000).toFixed(1))
    : 0;

  // 2. Daily metrics for chart
  const dailyDb = await db
    .select({
      dateStr: sql<string>`to_char(created_at, 'YYYY-MM-DD')`,
      requests: sql<number>`count(*)::int`,
      inputTokens: sql<number>`sum(coalesce(input_tokens, 0))::int`,
      outputTokens: sql<number>`sum(coalesce(output_tokens, 0))::int`,
    })
    .from(schema.aiRequests)
    .where(
      and(
        eq(schema.aiRequests.userId, user.id),
        gt(schema.aiRequests.createdAt, since)
      )
    )
    .groupBy(sql`to_char(created_at, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(created_at, 'YYYY-MM-DD') asc`);

  // Fill in missing dates to ensure chart is smooth and doesn't have gaps
  const daily: Array<{
    date: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
  }> = [];
  const dailyMap = new Map(dailyDb.map((d) => [d.dateStr, d]));

  const daysCount = timeframe === "today" ? 1 : timeframe === "7days" ? 7 : 30;
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0];
    const match = dailyMap.get(dateStr);
    daily.push({
      date: dateStr,
      requests: match?.requests ?? 0,
      inputTokens: match?.inputTokens ?? 0,
      outputTokens: match?.outputTokens ?? 0,
    });
  }

  // 3. Recent requests log (last 5)
  const recent = await db
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
    .where(eq(schema.aiRequests.userId, user.id))
    .orderBy(desc(schema.aiRequests.createdAt))
    .limit(5);

  return {
    summary: {
      totalRequests,
      successRate,
      totalTokens,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      avgLatencySec,
    },
    daily,
    recent,
  };
}
