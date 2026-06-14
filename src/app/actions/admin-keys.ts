"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { encryptApiKey } from "@/lib/crypto";
import { validatedAction } from "@/lib/action-builder";
import { z } from "zod";

const addSystemApiKeySchema = z.object({
  name: z.string().trim().min(1, "Tên gợi nhớ là bắt buộc"),
  apiKey: z.string().trim().min(1, "API Key là bắt buộc"),
  provider: z.string().trim().default("gemini"),
});

export const addSystemApiKeyAction = validatedAction(
  addSystemApiKeySchema,
  async (data, user) => {
    const encrypted = encryptApiKey(data.apiKey);

    await db.insert(schema.aiApiKeys).values({
      name: data.name,
      provider: data.provider,
      encryptedKey: encrypted,
      status: "active",
    });

    revalidatePath("/admin/keys");
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
    revalidatePath("/admin/keys");
  },
  { role: "admin" }
);

const reverifySystemApiKeySchema = z.object({
  keyId: z.string().uuid("ID API Key không hợp lệ"),
});

export const reverifySystemApiKeyAction = validatedAction(
  reverifySystemApiKeySchema,
  async (data, user) => {
    await db
      .update(schema.aiApiKeys)
      .set({
        status: "active",
        errorMessage: null,
        rateLimitedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiApiKeys.id, data.keyId));

    revalidatePath("/admin/keys");
  },
  { role: "admin" }
);
