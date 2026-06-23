"use server";

import { z } from "zod";
import { validatedAction } from "@/lib/action-builder";
import { llmProvider } from "@/domain/ai";
import type { Prompt } from "@/domain/ai";
import type { AiPurpose, AiModelKind } from "@/domain/types";

const templateResponseSchema = z.object({
  text: z.string().min(1),
});

type TemplateResponse = z.infer<typeof templateResponseSchema>;

class AiTemplatePrompt implements Prompt<TemplateResponse> {
  public readonly purpose: AiPurpose = "analysis";
  public readonly promptVersion = "ai-template-v1";
  public readonly schemaVersion = "ai-template-schema-v1";
  public readonly schema = templateResponseSchema;
  public readonly modelKind: AiModelKind = "fast";
  public readonly expectedShape = { text: "string" };

  constructor(private readonly type: "write" | "read") {}

  render(): string {
    const isWrite = this.type === "write";
    return [
      "You are an AI assistant helping a Vietnamese professional practice English in a software or business context.",
      `Generate a short English paragraph (1 to 3 sentences) suitable for the following study mode: "${this.type}".`,
      isWrite
        ? "The paragraph must represent a typical draft written by a Vietnamese software engineer or professional that contains common grammatical errors, awkward word-by-word literal translations (Vietlish), or improper register/tone (e.g., using 'I very like this solution', 'Yesterday I go to office and my manager say we must make plan', or 'You must review this now'). The paragraph should have clear mistakes that can be corrected and learned from."
        : "The paragraph must represent a correct, natural, and professional standard English text. It could be a polite Slack status update, a clear email to a client, a well-formed Jira ticket description, or technical documentation. It must NOT contain any grammatical or stylistic errors.",
      "Provide the text in the required JSON schema.",
    ].join("\n\n");
  }
}

const generateAiTemplateSchema = z.object({
  type: z.enum(["write", "read"]),
});

export const generateAiTemplateAction = validatedAction(
  generateAiTemplateSchema,
  async (data, user) => {
    const result = await llmProvider.generateJson({
      userId: user.id,
      prompt: new AiTemplatePrompt(data.type),
    });

    return {
      success: true as const,
      text: result.text,
    };
  }
);
