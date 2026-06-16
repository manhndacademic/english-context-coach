"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { decryptApiKey, encryptApiKey } from "@/lib/crypto";
import { validatedAction } from "@/lib/action-builder";
import { recordAdminAuditLog } from "@/domain/admin/audit";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const GEMINI_TEST_MODEL = "gemini-3.1-flash-lite";

async function verifyGeminiApiKey(apiKey: string): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({
      model: GEMINI_TEST_MODEL,
      contents: "ping",
    });
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Không thể xác thực API Key với Gemini.";
  }
}

const addSystemApiKeySchema = z.object({
  name: z.string().trim().min(1, "Tên gợi nhớ là bắt buộc"),
  apiKey: z.string().trim().min(1, "API Key là bắt buộc"),
  provider: z.string().trim().default("gemini"),
});

export const addSystemApiKeyAction = validatedAction(
  addSystemApiKeySchema,
  async (data, user) => {
    const verifyError = await verifyGeminiApiKey(data.apiKey);
    if (verifyError)
      return { error: `Xác thực API Key thất bại: ${verifyError}` } as any;

    const [created] = await db
      .insert(schema.aiApiKeys)
      .values({
        name: data.name,
        provider: data.provider,
        encryptedKey: encryptApiKey(data.apiKey),
        status: "active",
      })
      .returning({ id: schema.aiApiKeys.id });

    await recordAdminAuditLog({
      adminUserId: user.id,
      targetResourceType: "system_api_key",
      targetResourceId: created.id,
      action: "add_system_api_key",
      metadata: { provider: data.provider, name: data.name },
    });

    revalidatePath("/admin/keys");
    return { success: true } as any;
  },
  { role: "admin" }
);

const deleteSystemApiKeySchema = z.object({
  keyId: z.string().uuid("ID API Key không hợp lệ"),
});

export const deleteSystemApiKeyAction = validatedAction(
  deleteSystemApiKeySchema,
  async (data, user) => {
    await db
      .delete(schema.aiApiKeys)
      .where(eq(schema.aiApiKeys.id, data.keyId));
    await recordAdminAuditLog({
      adminUserId: user.id,
      targetResourceType: "system_api_key",
      targetResourceId: data.keyId,
      action: "delete_system_api_key",
    });
    revalidatePath("/admin/keys");
    return { success: true } as any;
  },
  { role: "admin" }
);

const reverifySystemApiKeySchema = z.object({
  keyId: z.string().uuid("ID API Key không hợp lệ"),
});

export const reverifySystemApiKeyAction = validatedAction(
  reverifySystemApiKeySchema,
  async (data, user) => {
    const [keyRow] = await db
      .select()
      .from(schema.aiApiKeys)
      .where(eq(schema.aiApiKeys.id, data.keyId))
      .limit(1);
    if (!keyRow) return { error: "Không tìm thấy API Key hệ thống." } as any;

    const verifyError = await verifyGeminiApiKey(
      decryptApiKey(keyRow.encryptedKey)
    );
    await db
      .update(schema.aiApiKeys)
      .set({
        status: verifyError ? "invalid" : "active",
        errorMessage: verifyError,
        rateLimitedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiApiKeys.id, data.keyId));

    await recordAdminAuditLog({
      adminUserId: user.id,
      targetResourceType: "system_api_key",
      targetResourceId: data.keyId,
      action: "reverify_system_api_key",
      metadata: { result: verifyError ? "invalid" : "active" },
    });

    revalidatePath("/admin/keys");
    return verifyError
      ? ({ error: `Xác thực API Key thất bại: ${verifyError}` } as any)
      : ({ success: true } as any);
  },
  { role: "admin" }
);
