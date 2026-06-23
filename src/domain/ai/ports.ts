import { z } from "zod";
import type { AiPurpose, AiModelKind } from "@/domain/types";
import { type DbClient } from "@/db";
import type { GenerateJsonOptions, RecordRequestOptions } from "./types";

export interface Prompt<T> {
  purpose: AiPurpose;
  promptVersion: string;
  schemaVersion: string;
  schema: z.ZodType<T>;
  modelKind: AiModelKind;
  render(): string;
  expectedShape?: Record<string, any>;
}

export type GenerateJsonFn = <T>(options: GenerateJsonOptions<T>) => Promise<T>;

export interface LlmProvider {
  generateJson: GenerateJsonFn;
}

export type LLMProvider = LlmProvider;

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

export type RecordRequestFn = (
  options: RecordRequestOptions,
  dbClient?: DbClient
) => Promise<void>;

export interface AiRequestRecorder {
  recordRequest: RecordRequestFn;
}
