import type { Timeframe } from "@/domain/types";

export interface AddUserApiKeyInput {
  name: string;
  apiKey: string;
  provider: "gemini";
}

export interface UserApiKey {
  id: string;
  userId: string;
  provider: string;
  name: string;
  encryptedKey: string;
  keyFingerprint: string | null;
  status: string;
  rateLimitedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UsageTimeframe = Timeframe;

export interface UsageStats {
  summary: {
    totalRequests: number;
    successRate: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    avgLatencySec: number;
    personalKeys: {
      total: number;
      active: number;
      invalid: number;
      rateLimited: number;
    };
  };
  daily: Array<{
    date: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
  }>;
  recent: Array<{
    id: string;
    purpose: string;
    model: string;
    status: string;
    latencyMs: number | null;
    errorMessage: string | null;
    createdAt: Date;
  }>;
}
