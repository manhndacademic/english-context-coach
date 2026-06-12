import type { LLMProvider } from "@/domain/ai";
import { analysisPrompt, exercisesPrompt } from "@/lib/ai/prompts";
import { analysisSchema, exercisesSchema } from "@/lib/ai/schemas";
import { PROMPT_VERSIONS } from "@/domain/constants";
import type { GenerationEngine } from "../ports";
import type { AnalysisResult, ExercisesResult } from "@/lib/ai/schemas";

export class GeminiGenerationEngine implements GenerationEngine {
  constructor(
    private llm: LLMProvider,
    private userId?: string,
    private lessonId?: string
  ) {}

  async generateAnalysis(
    sourceText: string,
    onThought?: (text: string) => Promise<void>
  ): Promise<AnalysisResult> {
    return await this.llm.generateJson({
      userId: this.userId,
      lessonId: this.lessonId,
      purpose: "analysis",
      prompt: analysisPrompt(sourceText),
      promptVersion: PROMPT_VERSIONS.analysis,
      schemaVersion: "analysis",
      schema: analysisSchema,
      modelKind: "analysis",
      onThought,
    });
  }

  async generateExercises(
    analysis: AnalysisResult,
    onThought?: (text: string) => Promise<void>
  ): Promise<ExercisesResult> {
    return await this.llm.generateJson({
      userId: this.userId,
      lessonId: this.lessonId,
      purpose: "exercise_generation",
      prompt: exercisesPrompt(analysis),
      promptVersion: PROMPT_VERSIONS.exercises,
      schemaVersion: "exercises",
      schema: exercisesSchema,
      modelKind: "fast",
      onThought,
    });
  }
}
