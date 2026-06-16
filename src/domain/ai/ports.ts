import { z } from "zod";

export interface LLMProvider {
  generateJson<T>(options: {
    userId?: string;
    lessonId?: string;
    purpose: "analysis" | "exercise_generation" | "grading" | "repair";
    prompt: string;
    promptVersion: string;
    schemaVersion: string;
    schema: z.ZodType<T>;
    modelKind: "analysis" | "fast";
    onThought?: (text: string) => Promise<void>;
  }): Promise<T>;
}

export interface KeyResolver {
  resolveApiKeyWithExclusions(
    userId?: string,
    excludedKeyIds?: Set<string>,
    model?: string
  ): Promise<{ key: string; id?: string; isUserKey: boolean }>;

  markKeyRateLimited(
    keyId: string,
    errorMsg: string,
    model?: string
  ): Promise<void>;
  markKeyInvalid(keyId: string, errorMsg: string): Promise<void>;
  restoreKeyToActive(keyId: string): Promise<void>;
  saveUserApiKey(userId: string, encryptedApiKey: string | null): Promise<void>;
}

export interface AiRequestRecorder {
  recordRequest(options: {
    userId?: string;
    lessonId?: string;
    purpose: "analysis" | "exercise_generation" | "grading" | "repair";
    provider: string;
    model: string;
    promptVersion: string;
    schemaVersion: string;
    payloadHash: string;
    status: "succeeded" | "failed";
    latencyMs: number;
    inputTokens: number | null;
    outputTokens: number | null;
    costMicros: number;
    errorClass: string | null;
    errorMessage: string | null;
  }): Promise<void>;
}
