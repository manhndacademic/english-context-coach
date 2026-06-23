import { db, schema, type DbClient } from "@/db";
import { getLogger } from "@/lib/logger";
import type { AiPurpose, AiRequestStatus } from "@/domain/types";

const logger = getLogger("d.m.ai.recordAiRequest", "ai-provider");

export async function recordAiRequest(
  options: {
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
  },
  dbClient: DbClient = db
): Promise<void> {
  try {
    await dbClient.insert(schema.aiRequests).values({
      userId: options.userId || null,
      lessonId: options.lessonId || null,
      purpose: options.purpose,
      provider: options.provider,
      model: options.model,
      promptVersion: options.promptVersion,
      schemaVersion: options.schemaVersion,
      payloadHash: options.payloadHash,
      status: options.status,
      latencyMs: options.latencyMs,
      inputTokens: options.inputTokens,
      outputTokens: options.outputTokens,
      costMicros: options.costMicros,
      errorClass: options.errorClass,
      errorMessage: options.errorMessage,
    });
  } catch (dbErr) {
    logger.error("Failed to record AI request to DB:", dbErr);
  }
}
