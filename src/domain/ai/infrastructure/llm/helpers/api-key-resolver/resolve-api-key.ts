import { resolveUserKeys } from "./user-key-resolver";
import { resolveSystemKeys } from "./system-key-resolver";
import { resolveEnvironmentKeys } from "./env-key-resolver";
import type { KeyResolverOptions } from "./db-key-validator";

export type { KeyResolverOptions } from "./db-key-validator";

/**
 * Resolves the appropriate Gemini API key using priority order:
 * 1. User custom keys (from DB or legacy fallbacks)
 * 2. System DB keys
 * 3. Environment variable fallbacks (GEMINI_API_KEYS / GEMINI_API_KEY)
 */
export async function resolveApiKey(
  options: KeyResolverOptions
): Promise<{ key: string; id?: string; isUserKey: boolean }> {
  // 1. Prefer user-owned API keys
  const userKey = await resolveUserKeys(options);
  if (userKey) return userKey;

  // 2. Check system keys
  const systemKey = await resolveSystemKeys(options);
  if (systemKey) return systemKey;

  // 3. Environment Fallbacks
  const envKey = await resolveEnvironmentKeys(options);
  if (envKey) return envKey;

  throw new Error("No active system, user, or fallback API keys available.");
}
