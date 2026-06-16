"use server";

import { revalidatePath } from "next/cache";
import { getKeyResolver } from "@/domain/ai";
import { decryptApiKey, encryptApiKey, sha256 } from "@/lib/crypto";
import { validatedAction } from "@/lib/action-builder";
import { requireUser } from "@/lib/auth/guards";
import { db, schema } from "@/db";
import { and, eq, gt, sql, desc, count } from "drizzle-orm";
import { z } from "zod";
import { verifyGeminiApiKey } from "@/domain/ai/adapters/gemini-utils";

const MAX_USER_KEYS = 10;

const saveUserApiKeySchema = z.object({ apiKey: z.string().trim() });

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
        const errors = await Promise.all(rawKeys.map(verifyGeminiApiKey));
        const firstError = errors.find(Boolean);
        if (firstError)
          return { error: `Xác thực API Key thất bại: ${firstError}` } as any;
        encryptedKey = JSON.stringify(rawKeys.map((k) => encryptApiKey(k)));
      }
    }
    await getKeyResolver().saveUserApiKey(user.id, encryptedKey);
    revalidatePath("/settings");
    return { success: true } as any;
  }
);

const userKeyIdSchema = z.object({
  keyId: z.string().uuid("ID API Key không hợp lệ"),
});
const addUserApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên key là bắt buộc")
    .max(80, "Tên key quá dài"),
  apiKey: z.string().trim().min(1, "API Key là bắt buộc"),
  provider: z.literal("gemini").default("gemini"),
});

export const addUserApiKeyAction = validatedAction(
  addUserApiKeySchema,
  async (data, user) => {
    const [{ value: existingCount }] = await db
      .select({ value: count() })
      .from(schema.userAiApiKeys)
      .where(eq(schema.userAiApiKeys.userId, user.id));
    if (existingCount >= MAX_USER_KEYS) {
      return {
        error: `Bạn chỉ có thể lưu tối đa ${MAX_USER_KEYS} API keys.`,
      } as any;
    }

    const fingerprint = sha256(`${data.provider}:${data.apiKey}`);
    const [duplicate] = await db
      .select({ id: schema.userAiApiKeys.id })
      .from(schema.userAiApiKeys)
      .where(
        and(
          eq(schema.userAiApiKeys.userId, user.id),
          eq(schema.userAiApiKeys.keyFingerprint, fingerprint)
        )
      )
      .limit(1);
    if (duplicate) return { error: "Key này đã tồn tại." } as any;

    const verifyError = await verifyGeminiApiKey(data.apiKey);
    if (verifyError)
      return { error: `Xác thực API Key thất bại: ${verifyError}` } as any;

    await db.insert(schema.userAiApiKeys).values({
      userId: user.id,
      provider: data.provider,
      name: data.name,
      encryptedKey: encryptApiKey(data.apiKey),
      keyFingerprint: fingerprint,
      status: "active",
    });
    revalidatePath("/settings");
    return { success: true } as any;
  }
);

export const deleteUserApiKeyAction = validatedAction(
  userKeyIdSchema,
  async (data, user) => {
    const deleted = await db
      .delete(schema.userAiApiKeys)
      .where(
        and(
          eq(schema.userAiApiKeys.id, data.keyId),
          eq(schema.userAiApiKeys.userId, user.id)
        )
      )
      .returning();
    if (deleted.length === 0) {
      return { error: "Không tìm thấy API Key hoặc không có quyền." } as any;
    }
    revalidatePath("/settings");
    return { success: true } as any;
  }
);

export const disableUserApiKeyAction = validatedAction(
  userKeyIdSchema,
  async (data, user) => {
    const updated = await db
      .update(schema.userAiApiKeys)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(
        and(
          eq(schema.userAiApiKeys.id, data.keyId),
          eq(schema.userAiApiKeys.userId, user.id)
        )
      )
      .returning();
    if (updated.length === 0) {
      return { error: "Không tìm thấy API Key hoặc không có quyền." } as any;
    }
    revalidatePath("/settings");
    return { success: true } as any;
  }
);

export const enableUserApiKeyAction = validatedAction(
  userKeyIdSchema,
  async (data, user) => {
    const [keyRow] = await db
      .select()
      .from(schema.userAiApiKeys)
      .where(
        and(
          eq(schema.userAiApiKeys.id, data.keyId),
          eq(schema.userAiApiKeys.userId, user.id)
        )
      )
      .limit(1);

    if (!keyRow) {
      return { error: "Không tìm thấy API Key hoặc không có quyền." } as any;
    }

    const rawKey = decryptApiKey(keyRow.encryptedKey);
    const verifyError = await verifyGeminiApiKey(rawKey);

    if (verifyError) {
      await db
        .update(schema.userAiApiKeys)
        .set({
          status: "invalid",
          errorMessage: verifyError,
          rateLimitedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.userAiApiKeys.id, keyRow.id));
      revalidatePath("/settings");
      return {
        error: `Không thể kích hoạt. Xác thực API Key thất bại: ${verifyError}`,
      } as any;
    }

    await db
      .update(schema.userAiApiKeys)
      .set({
        status: "active",
        errorMessage: null,
        rateLimitedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.userAiApiKeys.id, keyRow.id));

    revalidatePath("/settings");
    return { success: true } as any;
  }
);

export const reverifyUserApiKeyAction = validatedAction(
  userKeyIdSchema,
  async (data, user) => {
    const [keyRow] = await db
      .select()
      .from(schema.userAiApiKeys)
      .where(
        and(
          eq(schema.userAiApiKeys.id, data.keyId),
          eq(schema.userAiApiKeys.userId, user.id)
        )
      )
      .limit(1);
    if (!keyRow) {
      return { error: "Không tìm thấy API Key hoặc không có quyền." } as any;
    }
    const rawKey = decryptApiKey(keyRow.encryptedKey);
    const verifyError = await verifyGeminiApiKey(rawKey);
    await db
      .update(schema.userAiApiKeys)
      .set({
        status: verifyError ? "invalid" : "active",
        errorMessage: verifyError,
        rateLimitedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.userAiApiKeys.id, keyRow.id));
    revalidatePath("/settings");
    return verifyError
      ? ({ error: `Xác thực API Key thất bại: ${verifyError}` } as any)
      : ({ success: true } as any);
  }
);

export async function getUsageStatsAction(
  timeframe: "today" | "7days" | "30days"
) {
  const user = await requireUser();

  const now = new Date();
  let since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (timeframe === "today") {
    since = new Date(now);
    since.setHours(0, 0, 0, 0);
  } else if (timeframe === "30days") {
    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

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
  const totalInputTokens = summaryResult?.totalInputTokens ?? 0;
  const totalOutputTokens = summaryResult?.totalOutputTokens ?? 0;

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

  const [keyCounts] = await db
    .select({
      active: sql<number>`sum(case when status = 'active' then 1 else 0 end)::int`,
      invalid: sql<number>`sum(case when status = 'invalid' then 1 else 0 end)::int`,
      rateLimited: sql<number>`sum(case when status = 'rate_limited' then 1 else 0 end)::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(schema.userAiApiKeys)
    .where(eq(schema.userAiApiKeys.userId, user.id));

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
