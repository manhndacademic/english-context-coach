import { z } from "zod";
import type {
  AiPurpose,
  AiRequestStatus,
  AiModelKind,
  Timeframe,
} from "@/domain/types";
import type { Prompt } from "../application/ports/prompt";
import type { ApiKeyRepository } from "../application/ports/api-key-repository";
import type { AiRequestRecorder } from "../application/ports/ai-request-recorder";
import type { ApiRotationPool } from "../infrastructure/llm/api-rotation-pool";

// --- LLM Provider & Port Options ---

export interface GenerateJsonOptions<T> {
  userId?: string;
  lessonId?: string;
  prompt: Prompt<T>;
  onThought?: (text: string) => Promise<void>;
}

export interface RecordRequestOptions {
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
}

// --- Gemini LLM Provider Internals ---

export interface CallRawOptions {
  apiKey: string;
  model: string;
  prompt: string;
  purpose: AiPurpose;
  zodSchema?: z.ZodTypeAny;
  onThought?: (text: string) => Promise<void>;
}

export interface CallRawResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export type CallRawOverrideFn = (
  options: CallRawOptions
) => Promise<CallRawResult>;

export interface GeminiLlmProviderOptions {
  keyRepo?: ApiKeyRepository;
  requestRecorder?: AiRequestRecorder;
  apiRotationPool?: ApiRotationPool;
  callRawOverride?: CallRawOverrideFn;
}

export type GeminiLLMProviderOptions = GeminiLlmProviderOptions;

// --- API Rotation Pool Types ---

export interface ApiRotationPoolOptions {
  keyRepo?: any;
  analysisModels?: string[];
  fastModels?: string[];
}

export interface RotationExecutionContext {
  key: string;
  model: string;
  keyId?: string;
  isUserKey: boolean;
}

export type RotationExecuteFn<T> = (
  context: RotationExecutionContext
) => Promise<T>;

export interface RotationOptions<T> {
  userId?: string;
  modelKind: AiModelKind;
  purpose: AiPurpose;
  hasSchema?: boolean;
  execute: RotationExecuteFn<T>;
}

export interface RotationResult<T> {
  result: T;
  resolvedModel: string;
}

export interface ModelRotationOptions<T> {
  userId?: string;
  purpose: AiPurpose;
  execute: RotationExecuteFn<T>;
}

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
