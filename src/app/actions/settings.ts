"use server";

import { revalidatePath } from "next/cache";
import { getKeyResolver } from "@/domain/ai";
import { encryptApiKey } from "@/lib/crypto";
import { validatedAction } from "@/lib/action-builder";
import { z } from "zod";

const saveUserApiKeySchema = z.object({
  apiKey: z.string().trim(),
});

export const saveUserApiKeyAction = validatedAction(
  saveUserApiKeySchema,
  async (data, user) => {
    let encryptedKey: string | null = null;
    if (data.apiKey) {
      encryptedKey = encryptApiKey(data.apiKey);
    }

    await getKeyResolver().saveUserApiKey(user.id, encryptedKey);

    revalidatePath("/settings");
  }
);
