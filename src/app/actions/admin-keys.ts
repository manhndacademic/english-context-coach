"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { encryptApiKey } from "@/lib/crypto";

export async function addSystemApiKeyAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const rawKey = String(formData.get("apiKey") ?? "").trim();
  const provider = String(formData.get("provider") ?? "gemini").trim();

  if (!name || !rawKey) {
    throw new Error("Tên và API Key là bắt buộc.");
  }

  const encrypted = encryptApiKey(rawKey);

  await db.insert(schema.aiApiKeys).values({
    name,
    provider,
    encryptedKey: encrypted,
    status: "active",
  });

  revalidatePath("/admin/keys");
}

export async function deleteSystemApiKeyAction(keyId: string) {
  await requireAdmin();
  await db.delete(schema.aiApiKeys).where(eq(schema.aiApiKeys.id, keyId));
  revalidatePath("/admin/keys");
}

export async function reverifySystemApiKeyAction(keyId: string) {
  await requireAdmin();
  await db
    .update(schema.aiApiKeys)
    .set({
      status: "active",
      errorMessage: null,
      rateLimitedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.aiApiKeys.id, keyId));

  revalidatePath("/admin/keys");
}
