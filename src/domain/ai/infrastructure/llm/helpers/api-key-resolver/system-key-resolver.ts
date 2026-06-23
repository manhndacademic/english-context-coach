import { getLogger } from "@/lib/logger";
import { decryptApiKey } from "@/lib/crypto";
import { isDbKeyUsable, type KeyResolverOptions } from "./db-key-validator";

const logger = getLogger("d.m.ai.SystemKeyResolver", "ai-provider");

/**
 * Resolves active system-wide keys from database records.
 */
export async function resolveSystemKeys(
  options: KeyResolverOptions
): Promise<{ key: string; id: string; isUserKey: false } | null> {
  const { keyRepo } = options;
  const systemKeys = await keyRepo.getSystemKeys();
  const usableKeys = systemKeys.filter((k) => isDbKeyUsable(k, options));

  if (usableKeys.length > 0) {
    const picked = usableKeys[Math.floor(Math.random() * usableKeys.length)];
    try {
      const key = decryptApiKey(picked.encryptedKey);
      logger.debug(
        `[KeyResolver] Selected database system key keyId=${picked.id} name=${picked.name}`
      );
      return { key, id: picked.id, isUserKey: false };
    } catch (e) {
      logger.error(`Failed to decrypt system key ${picked.name}:`, e);
    }
  }

  return null;
}
