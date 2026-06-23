import { getLogger } from "@/lib/logger";
import { parseApiKeys } from "../apiPoolTypes";
import type { KeyResolverOptions } from "./db-key-validator";

const logger = getLogger("d.m.ai.EnvKeyResolver", "ai-provider");

/**
 * Resolves fallback keys defined in process environment variables.
 */
export async function resolveEnvironmentKeys(
  options: KeyResolverOptions
): Promise<{ key: string; id: string; isUserKey: false } | null> {
  const envKeys = getEnvironmentKeys();
  if (envKeys.length === 0) return null;

  const {
    excludedKeyIds,
    model,
    isKeyModelCooldown,
    isEnvKeyInvalid,
    isEnvKeyCooldown,
  } = options;
  const activeEnvKeys = envKeys
    .map((key, index) => ({ key, id: `env-key-${index}` }))
    .filter(({ id }) => {
      if (excludedKeyIds?.has(id)) return false;
      if (isEnvKeyInvalid(id)) return false;
      if (isEnvKeyCooldown(id)) return false;
      if (model && isKeyModelCooldown(id, model)) return false;
      return true;
    });

  if (activeEnvKeys.length > 0) {
    const picked =
      activeEnvKeys[Math.floor(Math.random() * activeEnvKeys.length)];
    logger.debug(
      `[KeyResolver] Selected environment fallback API key keyId=${picked.id}`
    );
    return { key: picked.key, id: picked.id, isUserKey: false };
  }

  return null;
}

/**
 * Parses and returns environment API keys list.
 */
export function getEnvironmentKeys(): string[] {
  if (process.env.GEMINI_API_KEYS) {
    return parseApiKeys(process.env.GEMINI_API_KEYS);
  }
  if (process.env.GEMINI_API_KEY) {
    return parseApiKeys(process.env.GEMINI_API_KEY);
  }
  return [];
}
