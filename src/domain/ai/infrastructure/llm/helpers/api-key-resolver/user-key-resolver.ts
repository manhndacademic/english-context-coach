import { getLogger } from "@/lib/logger";
import { decryptApiKey } from "@/lib/crypto";
import { isDbKeyUsable, type KeyResolverOptions } from "./db-key-validator";

const logger = getLogger("d.m.ai.UserKeyResolver", "ai-provider");

/**
 * Resolves active user API keys from either active database records or legacy string fallback config.
 */
export async function resolveUserKeys(
  options: KeyResolverOptions
): Promise<{ key: string; id: string; isUserKey: true } | null> {
  const { keyRepo, userId } = options;
  if (!userId) return null;

  // Try database user keys first
  const userKeys = await keyRepo.getUserKeys(userId);
  const usableKeys = userKeys.filter((k) => isDbKeyUsable(k, options));
  if (usableKeys.length > 0) {
    const picked = usableKeys[Math.floor(Math.random() * usableKeys.length)];
    const key = decryptApiKey(picked.encryptedKey);
    logger.debug(
      `[KeyResolver] Selected user custom API key keyId=${picked.id}`
    );
    return { key, id: picked.id, isUserKey: true };
  }

  // Legacy fallback
  const legacyKeyStr = await keyRepo.getLegacyUserKey(userId);
  if (legacyKeyStr) {
    return resolveLegacyUserKeys(legacyKeyStr, options);
  }

  return null;
}

/**
 * Resolves and decrypts legacy user keys.
 */
export function resolveLegacyUserKeys(
  legacyKeyStr: string,
  options: KeyResolverOptions
): { key: string; id: string; isUserKey: true } | null {
  const { userId, excludedKeyIds } = options;
  try {
    let encryptedKeys: string[] = [];
    const rawValue = legacyKeyStr.trim();
    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      encryptedKeys = JSON.parse(rawValue);
    } else {
      encryptedKeys = [rawValue];
    }

    const candidateKeys: { encKey: string; id: string }[] = [];
    for (let index = 0; index < encryptedKeys.length; index++) {
      const encKey = encryptedKeys[index];
      const id = `user-key-${index}`;
      if (!excludedKeyIds?.has(id)) {
        candidateKeys.push({ encKey, id });
      }
    }

    if (candidateKeys.length > 0) {
      const picked =
        candidateKeys[Math.floor(Math.random() * candidateKeys.length)];
      const key = decryptApiKey(picked.encKey);
      if (key) {
        logger.debug(
          `[KeyResolver] Selected legacy user custom API key keyId=${picked.id}`
        );
        return { key, id: picked.id, isUserKey: true };
      }
    } else if (encryptedKeys.length > 0) {
      const key = decryptApiKey(encryptedKeys[0]);
      if (key) {
        logger.debug(
          "[KeyResolver] Selected legacy user custom API key keyId=user-key-0 (fallback)"
        );
        return { key, id: "user-key-0", isUserKey: true };
      }
    }
  } catch (e) {
    logger.error(`Failed to decrypt/parse user custom keys for ${userId}:`, e);
  }
  return null;
}
