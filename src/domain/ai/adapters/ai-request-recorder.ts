import { db, schema } from "@/db";
import { getLogger } from "@/lib/logger";
import { AiRequestRecorder } from "../ports";
import type { AiPurpose, AiRequestStatus } from "@/domain/types";

const logger = getLogger("d.m.ai.DrizzleAiRequestRecorder", "ai-provider");

export class DrizzleAiRequestRecorder implements AiRequestRecorder {
  async recordRequest(options: {
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
  }): Promise<void> {
    try {
      await db.insert(schema.aiRequests).values({
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
}
