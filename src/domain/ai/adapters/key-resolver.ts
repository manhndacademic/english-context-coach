import { eq, and, or, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptApiKey } from "@/lib/crypto";
import { getLogger } from "@/lib/logger";
import { KeyResolver } from "../ports";

const logger = getLogger("d.m.ai.DrizzleKeyResolver", "ai-provider");

export function parseApiKeys(envKeysStr: string | undefined): string[] {
  if (!envKeysStr) return [];
  const rawParts = envKeysStr.split(/[,\n]+/);
  const keys: string[] = [];
  for (let part of rawParts) {
    let clean = part.split("#")[0].split("//")[0];
    clean = clean.trim();
    if (clean) {
      keys.push(clean);
    }
  }
  return keys;
}

export class DrizzleKeyResolver implements KeyResolver {
  private static readonly envKeyCooldowns = new Map<string, number>(); // keyId -> cooldownUntil epoch ms
  private static readonly envKeyInvalid = new Set<string>(); // keyId

  static resetEnvKeysForTest(): void {
    DrizzleKeyResolver.envKeyCooldowns.clear();
    DrizzleKeyResolver.envKeyInvalid.clear();
  }

  static getEnvKeysStatus(): {
    active: number;
    rateLimited: number;
    invalid: number;
    total: number;
  } {
    let envKeys: string[] = [];
    if (process.env.GEMINI_API_KEYS) {
      envKeys = parseApiKeys(process.env.GEMINI_API_KEYS);
    }
    if (envKeys.length === 0 && process.env.GEMINI_API_KEY) {
      envKeys = parseApiKeys(process.env.GEMINI_API_KEY);
    }

    const now = Date.now();
    let active = 0;
    let rateLimited = 0;
    let invalid = 0;

    for (let index = 0; index < envKeys.length; index++) {
      const keyId = `env-key-${index}`;
      if (DrizzleKeyResolver.envKeyInvalid.has(keyId)) {
        invalid++;
      } else {
        const cooldownUntil =
          DrizzleKeyResolver.envKeyCooldowns.get(keyId) ?? 0;
        if (now < cooldownUntil) {
          rateLimited++;
        } else {
          active++;
        }
      }
    }

    return {
      active,
      rateLimited,
      invalid,
      total: envKeys.length,
    };
  }

  async resolveApiKeyWithExclusions(
    userId?: string,
    excludedKeyIds?: Set<string>
  ): Promise<{ key: string; id?: string; isUserKey: boolean }> {
    // 1. Check if user has a custom API Key
    if (userId) {
      const [user] = await db
        .select({ customGeminiApiKey: schema.users.customGeminiApiKey })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      if (user?.customGeminiApiKey) {
        try {
          const key = decryptApiKey(user.customGeminiApiKey);
          if (key) {
            return { key, isUserKey: true };
          }
        } catch (e) {
          logger.error(`Failed to decrypt user key for ${userId}:`, e);
        }
      }
    }

    // 2. Check system keys in Database
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const systemKeys = await db
      .select()
      .from(schema.aiApiKeys)
      .where(
        or(
          eq(schema.aiApiKeys.status, "active"),
          and(
            eq(schema.aiApiKeys.status, "rate_limited"),
            lt(schema.aiApiKeys.rateLimitedAt, oneMinuteAgo)
          )
        )
      );

    // Filter out excluded key IDs
    const activeKeys = systemKeys.filter(
      (k) => !excludedKeyIds || !excludedKeyIds.has(k.id)
    );

    if (activeKeys.length > 0) {
      // Pick a key randomly
      const picked = activeKeys[Math.floor(Math.random() * activeKeys.length)];
      try {
        const key = decryptApiKey(picked.encryptedKey);
        return { key, id: picked.id, isUserKey: false };
      } catch (e) {
        logger.error(`Failed to decrypt system key ${picked.name}:`, e);
      }
    }

    // 3. Fall back to process.env.GEMINI_API_KEYS or process.env.GEMINI_API_KEY
    let envKeys: string[] = [];
    if (process.env.GEMINI_API_KEYS) {
      envKeys = parseApiKeys(process.env.GEMINI_API_KEYS);
    }
    if (envKeys.length === 0 && process.env.GEMINI_API_KEY) {
      envKeys = parseApiKeys(process.env.GEMINI_API_KEY);
    }

    if (envKeys.length > 0) {
      const now = Date.now();
      const activeEnvKeys = envKeys
        .map((key, index) => ({ key, id: `env-key-${index}` }))
        .filter((k) => {
          if (excludedKeyIds && excludedKeyIds.has(k.id)) return false;
          if (DrizzleKeyResolver.envKeyInvalid.has(k.id)) return false;
          const cooldownUntil =
            DrizzleKeyResolver.envKeyCooldowns.get(k.id) ?? 0;
          if (now < cooldownUntil) return false;
          return true;
        });

      if (activeEnvKeys.length > 0) {
        const picked =
          activeEnvKeys[Math.floor(Math.random() * activeEnvKeys.length)];
        return { key: picked.key, id: picked.id, isUserKey: false };
      }
    }

    throw new Error("No active system, user, or fallback API keys available.");
  }

  async markKeyRateLimited(keyId: string, errorMsg: string): Promise<void> {
    if (keyId.startsWith("env-key-")) {
      const cooldownUntil = Date.now() + 60 * 1000; // 1 minute
      DrizzleKeyResolver.envKeyCooldowns.set(keyId, cooldownUntil);
      logger.warn(
        `API key marked rate_limited (in-memory): ${keyId}. Error: ${errorMsg}`
      );
      return;
    }
    try {
      await db
        .update(schema.aiApiKeys)
        .set({
          status: "rate_limited",
          errorMessage: errorMsg,
          rateLimitedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.aiApiKeys.id, keyId));
      logger.warn(`API key marked rate_limited: ${keyId}. Error: ${errorMsg}`);
    } catch (e) {
      logger.error(`Failed to update rate_limited status for key ${keyId}:`, e);
    }
  }

  async markKeyInvalid(keyId: string, errorMsg: string): Promise<void> {
    if (keyId.startsWith("env-key-")) {
      DrizzleKeyResolver.envKeyInvalid.add(keyId);
      logger.error(
        `API key marked invalid (in-memory): ${keyId}. Error: ${errorMsg}`
      );
      return;
    }
    try {
      await db
        .update(schema.aiApiKeys)
        .set({
          status: "invalid",
          errorMessage: errorMsg,
          updatedAt: new Date(),
        })
        .where(eq(schema.aiApiKeys.id, keyId));
      logger.error(`API key marked invalid: ${keyId}. Error: ${errorMsg}`);
    } catch (e) {
      logger.error(`Failed to update invalid status for key ${keyId}:`, e);
    }
  }

  async restoreKeyToActive(keyId: string): Promise<void> {
    if (keyId.startsWith("env-key-")) {
      DrizzleKeyResolver.envKeyCooldowns.delete(keyId);
      logger.info(`Environment API key reset to active (in-memory): ${keyId}`);
      return;
    }
    try {
      await db
        .update(schema.aiApiKeys)
        .set({
          status: "active",
          errorMessage: null,
          rateLimitedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.aiApiKeys.id, keyId));
      logger.info(`API key reset to active: ${keyId}`);
    } catch (e) {
      logger.error(`Failed to restore active status for key ${keyId}:`, e);
    }
  }

  async saveUserApiKey(
    userId: string,
    encryptedApiKey: string | null
  ): Promise<void> {
    try {
      await db
        .update(schema.users)
        .set({
          customGeminiApiKey: encryptedApiKey,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, userId));
      logger.info(`Saved custom API key for user: ${userId}`);
    } catch (e) {
      logger.error(`Failed to save custom API key for user ${userId}:`, e);
      throw e;
    }
  }
}
