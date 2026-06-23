"use server";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { llmProvider } from "@/domain/ai";
import { getLearnerMemoryEngine } from "@/domain/memory";
import { getTextProcessor } from "@/domain/text";
import type { AiModelKind, AiPurpose } from "@/domain/types";
import { validatedAction } from "@/lib/action-builder";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const categorySchema = z.enum([
  "idiom",
  "phrasal_verb",
  "technical_term",
  "collocation",
  "grammar_pattern",
  "business_phrase",
  "general_phrase",
]);

const levelSchema = z.enum(["A2", "B1", "B2", "C1"]);

const customPhraseExplanationSchema = z.object({
  phrase: z.string().min(1),
  conceptKey: z.string().min(1),
  conceptPhrase: z.string().min(1),
  conceptMeaningVi: z.string().min(1),
  ipa: z.string().min(1),
  meaningVi: z.string().min(1),
  meaningInContextVi: z.string().min(1),
  whyConfusingVi: z.string().min(1),
  category: categorySchema,
  difficulty: levelSchema,
  exampleEn: z.string().min(1),
  exampleVi: z.string().min(1),
});

export type CustomPhraseExplanation = z.infer<
  typeof customPhraseExplanationSchema
>;

class ExplainPhrasePrompt {
  purpose: AiPurpose = "analysis";
  promptVersion = "1.0.0";
  schemaVersion = "1.0.0";
  schema = customPhraseExplanationSchema;
  modelKind: AiModelKind = "fast";

  constructor(
    private phrase: string,
    private sentenceContext: string,
    private fullText: string
  ) {}

  render(): string {
    return `You are a professional English coach explaining vocabulary/phrases to a Vietnamese learner.
Explain the word or phrase "${this.phrase}" in the context of this sentence: "${this.sentenceContext}".

Full Source Text for overall context (use it to understand the tone, register, and topic):
"${this.fullText}"

Explain it in Vietnamese. Provide:
1. The exact phrase (as specified).
2. The conceptKey: A lowercase snake_case concept identifier (e.g. "push_back", "run_into_trouble").
3. The conceptPhrase: The canonical base form of the phrase (e.g. "push back", "run into").
4. The conceptMeaningVi: The base Vietnamese meaning.
5. The General American (US English) IPA pronunciation (without slashes or brackets, e.g. "pʊʃ bæk").
6. The general meaning in Vietnamese.
7. The specific meaning of this phrase in this context (in Vietnamese).
8. Why this word/phrase is confusing for Vietnamese learners, or common translation traps to avoid (word-by-word/literal translation traps, collocations, false friends).
9. The category of the phrase.
10. The difficulty level of the phrase.
11. A new example sentence in English using this phrase in a similar context.
12. The natural Vietnamese translation of that new example sentence.

Return the result as a JSON object matching the requested schema.`;
  }
}

// 1. Action to explain the phrase on-demand using Gemini
const explainPhraseInputSchema = z.object({
  lessonId: z.string().uuid(),
  phrase: z.string().trim().min(1),
  sentenceContext: z.string().trim().min(1),
});

export const explainPhraseAction = validatedAction(
  explainPhraseInputSchema,
  async (
    data,
    user
  ): Promise<{
    success: boolean;
    data?: CustomPhraseExplanation;
    error?: string;
  }> => {
    try {
      // Find the lesson and source text to get fullText context
      const lesson = await db.query.lessons.findFirst({
        where: (l, { eq, and }) =>
          and(eq(l.id, data.lessonId), eq(l.userId, user.id)),
      });

      if (!lesson) {
        return { success: false, error: "Không tìm thấy bài học tương ứng." };
      }

      const sourceText = await db.query.sourceTexts.findFirst({
        where: (st, { eq, and }) =>
          and(eq(st.id, lesson.sourceTextId), eq(st.userId, user.id)),
      });

      if (!sourceText) {
        return {
          success: false,
          error: "Không tìm thấy văn bản gốc tương ứng.",
        };
      }

      const llm = llmProvider;
      const prompt = new ExplainPhrasePrompt(
        data.phrase,
        data.sentenceContext,
        sourceText.content
      );

      const result = await llm.generateJson({
        userId: user.id,
        lessonId: data.lessonId,
        prompt,
      });

      return { success: true, data: result };
    } catch (err) {
      console.error("[explainPhraseAction] Error explaining phrase:", err);
      return {
        success: false,
        error:
          err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.",
      };
    }
  }
);

// 2. Action to save the custom explanation to the lesson key phrases
const saveCustomPhraseInputSchema = z.object({
  lessonId: z.string().uuid(),
  explanation: customPhraseExplanationSchema,
});

export const saveCustomPhraseAction = validatedAction(
  saveCustomPhraseInputSchema,
  async (data, user): Promise<{ success: boolean; error?: string }> => {
    try {
      const { lessonId, explanation } = data;
      const textProcessor = getTextProcessor();

      const normalized = textProcessor.normalizePhrase(explanation.phrase);
      const senseKey = textProcessor.buildSenseKey(
        explanation.phrase,
        explanation.meaningVi,
        explanation.category
      );

      const isSensitive =
        !textProcessor.isSafe(explanation.phrase) ||
        !textProcessor.isSafe(explanation.meaningVi) ||
        !textProcessor.isSafe(explanation.meaningInContextVi);

      // Insert custom key phrase into database
      const [inserted] = await db
        .insert(schema.keyPhrases)
        .values({
          lessonId,
          userId: user.id,
          phrase: explanation.phrase,
          conceptKey: explanation.conceptKey,
          conceptPhrase: explanation.conceptPhrase,
          conceptMeaningVi: explanation.conceptMeaningVi,
          normalizedPhrase: normalized,
          senseKey,
          meaningVi: explanation.meaningVi,
          meaningInContextVi: explanation.meaningInContextVi,
          examples: [
            {
              exampleEn: explanation.exampleEn,
              exampleVi: explanation.exampleVi,
            },
          ],
          literalTranslationVi: null,
          naturalTranslationVi: explanation.meaningInContextVi,
          whyConfusingVi: explanation.whyConfusingVi || null,
          ipa: explanation.ipa || null,
          category: explanation.category,
          difficulty: explanation.difficulty,
          isSensitive,
        })
        .returning();

      // Trigger SRS card creation for this key phrase
      if (inserted) {
        await getLearnerMemoryEngine().bulkCreateSrsCardsFromKeyPhrases(
          user.id,
          [
            {
              id: inserted.id,
              conceptKey: inserted.conceptKey,
              normalizedPhrase: inserted.normalizedPhrase,
              senseKey: inserted.senseKey,
              category: inserted.category as any,
              conceptMeaningVi: inserted.conceptMeaningVi,
              isSensitive: inserted.isSensitive,
            },
          ]
        );
      }

      revalidatePath(`/lessons/${lessonId}`);
      return { success: true };
    } catch (err) {
      console.error("[saveCustomPhraseAction] Error saving phrase:", err);
      return {
        success: false,
        error:
          err instanceof Error ? err.message : "Đã xảy ra lỗi khi lưu từ vựng.",
      };
    }
  }
);
