import { type DbClient } from "@/db";
import type { UserApiKey } from "../../domain/types";

export interface UserApiKeyRepository {
  add(
    userId: string,
    name: string,
    encryptedKey: string,
    keyFingerprint: string,
    dbClient?: DbClient
  ): Promise<void>;
  delete(userId: string, id: string, dbClient?: DbClient): Promise<void>;
  updateStatus(
    id: string,
    status: "active" | "disabled" | "invalid",
    errorMessage: string | null,
    dbClient?: DbClient
  ): Promise<void>;
  findById(
    userId: string,
    id: string,
    dbClient?: DbClient
  ): Promise<UserApiKey | null>;
  countForUser(userId: string, dbClient?: DbClient): Promise<number>;
  checkDuplicate(
    userId: string,
    keyFingerprint: string,
    dbClient?: DbClient
  ): Promise<boolean>;
}
