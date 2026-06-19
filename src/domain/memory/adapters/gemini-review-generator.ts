import type { LLMProvider } from "@/domain/ai";
import { ReviewPromptGenerationPrompt } from "../prompts";
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
      prompt: new ReviewPromptGenerationPrompt({
        conceptPhrase: input.conceptPhrase,
        conceptMeaningVi: input.conceptMeaningVi,
        category: input.category,
        errorType: input.errorType,
      }),
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
