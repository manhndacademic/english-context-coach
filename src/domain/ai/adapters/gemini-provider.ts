import { generateJson as generateJsonLib } from "@/lib/ai/provider";
import { db, schema } from "@/db";
import type { LLMProvider } from "../ports";
import type { z } from "zod";

export class GeminiLLMProvider implements LLMProvider {
  async generateJson<T>(options: {
    userId?: string;
    lessonId?: string;
    purpose: "analysis" | "exercise_generation" | "grading" | "repair";
    prompt: string;
    promptVersion: string;
    schemaVersion: string;
    schema: z.ZodType<T>;
    modelKind: "analysis" | "fast";
    onThought?: (text: string) => Promise<void>;
  }): Promise<T> {
    return await generateJsonLib({
      userId: options.userId,
      lessonId: options.lessonId,
      purpose: options.purpose,
      prompt: options.prompt,
      promptVersion: options.promptVersion,
      schemaVersion: options.schemaVersion as any,
      schema: options.schema,
      modelKind: options.modelKind,
      onThought: options.onThought,
      onRecordRequest: async (record) => {
        await db.insert(schema.aiRequests).values({
          userId: record.userId ?? null,
          lessonId: record.lessonId ?? null,
          purpose: record.purpose,
          provider: "gemini",
          model: record.model,
          promptVersion: record.promptVersion,
          schemaVersion: record.schemaVersion,
          payloadHash: record.payloadHash,
          status: record.status,
          latencyMs: record.latencyMs,
          errorClass: record.errorClass ?? null,
        });
      },
    });
  }
}
