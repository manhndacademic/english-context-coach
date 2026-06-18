import type { LLMProvider } from "@/domain/ai";
import { reviewPromptGenerationPrompt } from "@/lib/ai/prompts";
import { reviewPromptSchema } from "@/lib/ai/schemas";
import { PROMPT_VERSIONS } from "@/domain/constants";
import type { ReviewPromptGenerator } from "../ports";
import { cleanEmbeddedQuotesOrBackticks } from "@/lib/utils";

export class GeminiReviewPromptGenerator implements ReviewPromptGenerator {
  constructor(private llm: LLMProvider) {}

  async generate(input: {
    userId: string;
    conceptPhrase: string;
    conceptMeaningVi: string;
    category: string;
    errorType: string;
  }): Promise<{
    reviewType: string;
    reviewPromptEn: string;
    reviewPromptVi: string;
    reviewRubricVi: string;
    reviewCorrectAnswer: string;
    reviewAcceptableAnswers: string[];
    reviewChoices: string[] | null;
  }> {
    const result = await this.llm.generateJson({
      userId: input.userId,
      purpose: "exercise_generation",
      prompt: reviewPromptGenerationPrompt({
        conceptPhrase: input.conceptPhrase,
        conceptMeaningVi: input.conceptMeaningVi,
        category: input.category,
        errorType: input.errorType,
      }),
      promptVersion: PROMPT_VERSIONS.review_prompt,
      schemaVersion: "review_prompt",
      schema: reviewPromptSchema,
      modelKind: "fast",
    });

    return {
      reviewType: result.reviewType,
      reviewPromptEn: cleanEmbeddedQuotesOrBackticks(result.reviewPromptEn),
      reviewPromptVi: result.reviewPromptVi,
      reviewRubricVi: result.reviewRubricVi,
      reviewCorrectAnswer: cleanEmbeddedQuotesOrBackticks(
        result.reviewCorrectAnswer
      ),
      reviewAcceptableAnswers: result.reviewAcceptableAnswers.map((a) =>
        cleanEmbeddedQuotesOrBackticks(a)
      ),
      reviewChoices: result.reviewChoices
        ? result.reviewChoices.map((c) => cleanEmbeddedQuotesOrBackticks(c))
        : null,
    };
  }
}
