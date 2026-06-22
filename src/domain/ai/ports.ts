import { z } from "zod";
import type { AiPurpose, AiRequestStatus, AiModelKind } from "@/domain/types";

export interface Prompt<T> {
  purpose: AiPurpose;
  promptVersion: string;
  schemaVersion: string;
  schema: z.ZodType<T>;
  modelKind: AiModelKind;
  render(): string;
  expectedShape?: Record<string, any>;
}

export interface LLMProvider {
  generateJson<T>(options: {
    userId?: string;
    lessonId?: string;
    prompt: Prompt<T>;
    onThought?: (text: string) => Promise<void>;
  }): Promise<T>;
}

export interface ApiKeyRepository {
  getSystemKeys(): Promise<
    Array<{
      id: string;
      name: string;
      encryptedKey: string;
      status: string;
      rateLimitedAt: Date | null;
    }>
  >;
  getUserKeys(userId: string): Promise<
    Array<{
      id: string;
      encryptedKey: string;
      status: string;
      rateLimitedAt: Date | null;
    }>
  >;
  getLegacyUserKey(userId: string): Promise<string | null>;
  updateKeyStatus(
    keyId: string,
    status: "active" | "rate_limited" | "invalid",
    errorMessage: string | null
  ): Promise<void>;
  saveUserApiKey(userId: string, encryptedApiKey: string | null): Promise<void>;
}

export interface AiRequestRecorder {
  recordRequest(options: {
    userId?: string;
    lessonId?: string;
    purpose: AiPurpose;
    provider: string;
    model: string;
    promptVersion: string;
    schemaVersion: string;
    payloadHash: string;
    status: AiRequestStatus;
    latencyMs: number;
    inputTokens: number | null;
    outputTokens: number | null;
    costMicros: number;
    errorClass: string | null;
    errorMessage: string | null;
  }): Promise<void>;
}
