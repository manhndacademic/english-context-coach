import { type DbClient } from "@/db";

export interface ApiKeyRepository {
  getSystemKeys(dbClient?: DbClient): Promise<
    Array<{
      id: string;
      name: string;
      encryptedKey: string;
      status: string;
      rateLimitedAt: Date | null;
    }>
  >;
  getUserKeys(
    userId: string,
    dbClient?: DbClient
  ): Promise<
    Array<{
      id: string;
      encryptedKey: string;
      status: string;
      rateLimitedAt: Date | null;
    }>
  >;
  getLegacyUserKey(userId: string, dbClient?: DbClient): Promise<string | null>;
  updateKeyStatus(
    keyId: string,
    status: "active" | "rate_limited" | "invalid",
    errorMessage: string | null,
    dbClient?: DbClient
  ): Promise<void>;
  saveUserApiKey(
    userId: string,
    encryptedApiKey: string | null,
    dbClient?: DbClient
  ): Promise<void>;
}
