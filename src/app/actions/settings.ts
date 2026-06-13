"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { encryptApiKey } from "@/lib/crypto";

export async function saveUserApiKeyAction(formData: FormData) {
  const user = await requireUser();
  const rawKey = String(formData.get("apiKey") ?? "").trim();

  let encryptedKey: string | null = null;
  if (rawKey) {
    encryptedKey = encryptApiKey(rawKey);
  }

  await db
    .update(schema.users)
    .set({
      customGeminiApiKey: encryptedKey,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, user.id));

  revalidatePath("/settings");
}
