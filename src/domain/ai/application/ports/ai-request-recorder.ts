import { type DbClient } from "@/db";
import type { AiPurpose, AiRequestStatus } from "@/domain/types";

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

export type RecordRequestFn = (
  options: RecordRequestOptions,
  dbClient?: DbClient
) => Promise<void>;

export interface AiRequestRecorder {
  recordRequest: RecordRequestFn;
}
