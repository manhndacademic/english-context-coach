import { subMinutes, isAfter } from "date-fns";
import type { ApiKeyRepository } from "../../../ports";

export interface KeyResolverOptions {
  keyRepo: ApiKeyRepository;
  userId?: string;
  excludedKeyIds?: Set<string>;
  model?: string;
  isKeyModelCooldown: (keyId: string, model: string) => boolean;
  isEnvKeyInvalid: (keyId: string) => boolean;
  isEnvKeyCooldown: (keyId: string) => boolean;
}

export interface DbApiKey {
  id: string;
  status: string;
  rateLimitedAt: Date | null;
}

/**
 * Checks if a database-managed API key is active, not rate-limited, and not in cooldown.
 */
export function isDbKeyUsable(
  k: DbApiKey,
  options: KeyResolverOptions,
  now: number = Date.now()
): boolean {
  const { excludedKeyIds, model, isKeyModelCooldown } = options;
  if (excludedKeyIds?.has(k.id)) return false;
  if (k.status === "invalid") return false;
  if (k.status === "rate_limited" && k.rateLimitedAt) {
    const oneMinuteAgo = subMinutes(new Date(now), 1);
    if (isAfter(k.rateLimitedAt, oneMinuteAgo)) return false;
  }
  if (model && isKeyModelCooldown(k.id, model)) return false;
  return true;
}
