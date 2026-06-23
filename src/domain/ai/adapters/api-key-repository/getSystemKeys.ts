import { db, schema, type DbClient } from "@/db";

export async function getSystemKeys(dbClient: DbClient = db) {
  return await dbClient
    .select({
      id: schema.aiApiKeys.id,
      name: schema.aiApiKeys.name,
      encryptedKey: schema.aiApiKeys.encryptedKey,
      status: schema.aiApiKeys.status,
      rateLimitedAt: schema.aiApiKeys.rateLimitedAt,
    })
    .from(schema.aiApiKeys);
}
