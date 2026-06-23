import { z } from "zod";
import type { AiPurpose, AiRequestStatus, AiModelKind } from "@/domain/types";
import type { Prompt, ApiKeyRepository, AiRequestRecorder } from "./ports";
import type { ApiRotationPool } from "./adapters/ApiRotationPool";

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

// --- User API Key Types ---

export interface AddUserApiKeyInput {
  name: string;
  apiKey: string;
  provider: "gemini";
}
