"use server";

import { revalidatePath } from "next/cache";
import {
  getApiKeyRepository,
  getUserApiKeyRepository,
  getUsageRepository,
} from "@/domain/ai";
import { encryptApiKey } from "@/lib/crypto";
import { validatedAction } from "@/lib/action-builder";
import { requireUser } from "@/lib/auth/guards";
import { z } from "zod";
import { verifyGeminiApiKey } from "@/domain/ai/infrastructure/llm/gemini-utils";
import type { Timeframe } from "@/domain/types";

const saveUserApiKeySchema = z.object({ apiKey: z.string().trim() });

export const saveUserApiKeyAction = validatedAction(
  saveUserApiKeySchema,
  async (data, user) => {
    let encryptedKey: string | null = null;
    if (data.apiKey) {
      const rawKeys = data.apiKey.split(/[,\n]+/).flatMap((k) => {
        const trimmed = k.trim();
        return trimmed ? [trimmed] : [];
      });
      if (rawKeys.length > 0) {
        const errors = await Promise.all(rawKeys.map(verifyGeminiApiKey));
        const firstError = errors.find(Boolean);
        if (firstError)
          return { error: `Xác thực API Key thất bại: ${firstError}` } as any;
        encryptedKey = JSON.stringify(rawKeys.map((k) => encryptApiKey(k)));
      }
    }
    await getApiKeyRepository().saveUserApiKey(user.id, encryptedKey);
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
    const result = await getUserApiKeyRepository().add(user.id, data);
    if (!result.success) return { error: result.error } as any;
    revalidatePath("/settings");
    return { success: true } as any;
  }
);

export const deleteUserApiKeyAction = validatedAction(
  userKeyIdSchema,
  async (data, user) => {
    const result = await getUserApiKeyRepository().delete(user.id, data.keyId);
    if (!result.success) return { error: result.error } as any;
    revalidatePath("/settings");
    return { success: true } as any;
  }
);

export const disableUserApiKeyAction = validatedAction(
  userKeyIdSchema,
  async (data, user) => {
    const result = await getUserApiKeyRepository().disable(user.id, data.keyId);
    if (!result.success) return { error: result.error } as any;
    revalidatePath("/settings");
    return { success: true } as any;
  }
);

export const enableUserApiKeyAction = validatedAction(
  userKeyIdSchema,
  async (data, user) => {
    const result = await getUserApiKeyRepository().enable(user.id, data.keyId);
    if (!result.success) {
      revalidatePath("/settings");
      return { error: result.error } as any;
    }
    revalidatePath("/settings");
    return { success: true } as any;
  }
);

export const reverifyUserApiKeyAction = validatedAction(
  userKeyIdSchema,
  async (data, user) => {
    const result = await getUserApiKeyRepository().reverify(
      user.id,
      data.keyId
    );
    revalidatePath("/settings");
    return result.success
      ? ({ success: true } as any)
      : ({ error: result.error } as any);
  }
);

export async function getUsageStatsAction(timeframe: Timeframe) {
  const user = await requireUser();
  return getUsageRepository().getUserUsageStats(user.id, timeframe);
}
