"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { getKeyResolver } from "@/domain/ai";
import { encryptApiKey } from "@/lib/crypto";

export async function saveUserApiKeyAction(formData: FormData) {
  const user = await requireUser();
  const rawKey = String(formData.get("apiKey") ?? "").trim();

  let encryptedKey: string | null = null;
  if (rawKey) {
    encryptedKey = encryptApiKey(rawKey);
  }

  await getKeyResolver().saveUserApiKey(user.id, encryptedKey);

  revalidatePath("/settings");
}
