import { generateJson as generateJsonLib } from "@/lib/ai/provider";
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
    });
  }
}
