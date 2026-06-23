import { db, schema, type DbClient } from "@/db";
import { encryptApiKey } from "@/lib/crypto";
import type { AddUserApiKeyInput } from "../types";
import { type ActionResult } from "@/domain/types";
import { validateAddKey } from "./validateAddKey";

export async function addUserApiKey(
  userId: string,
  data: AddUserApiKeyInput,
  dbClient: DbClient = db
): Promise<ActionResult> {
  const validation = await validateAddKey(userId, data, dbClient);
  if (!validation.success) {
    return validation;
  }

  await dbClient.insert(schema.userAiApiKeys).values({
    userId,
    provider: data.provider,
    name: data.name,
    encryptedKey: encryptApiKey(data.apiKey),
    keyFingerprint: validation.fingerprint,
    status: "active",
  });

  return { success: true };
}
