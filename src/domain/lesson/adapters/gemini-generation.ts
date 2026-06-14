import type { LLMProvider } from "@/domain/ai";
import { analysisPrompt, exercisesPrompt } from "@/lib/ai/prompts";
import { analysisSchema, exercisesSchema } from "@/lib/ai/schemas";
import { PROMPT_VERSIONS } from "@/domain/constants";
import type { GenerationEngine, SaveAnalysisInput, SaveExercisesInput } from "../ports";
import type { AnalysisResult, ExercisesResult } from "@/lib/ai/schemas";

export class GeminiGenerationEngine implements GenerationEngine {
  constructor(
    private llm: LLMProvider,
    private userId?: string,
    private lessonId?: string
  ) {}

  async generateAnalysis(
    sourceText: string,
    onThought?: (text: string) => Promise<void>,
    requestedMode?: string,
    userHighlights?: string[]
  ): Promise<SaveAnalysisInput> {
    let promptText = analysisPrompt(sourceText, userHighlights);
    if (requestedMode && requestedMode !== "auto") {
      promptText += `\n\nCRITICAL: The user has requested to process this text in mode: \`${requestedMode}\`. You MUST classify the inputMode as \`${requestedMode}\` and adapt the content fields accordingly.`;
    }
    const result = (await this.llm.generateJson({
      userId: this.userId,
      lessonId: this.lessonId,
      purpose: "analysis",
      prompt: promptText,
      promptVersion: PROMPT_VERSIONS.analysis,
      schemaVersion: "analysis",
      schema: analysisSchema,
      modelKind: "analysis",
      onThought,
    })) as AnalysisResult;

    return {
      title: result.title,
      textType: result.textType as any,
      inputMode: result.inputMode,
      detectedLevel: result.detectedLevel as any,
      summaryVi: result.summaryVi,
      naturalTranslationVi: result.naturalTranslationVi,
      contextExplanationVi: result.contextExplanationVi,
      sentenceBreakdowns: result.sentenceBreakdowns.map((breakdown) => ({
        sentence: breakdown.sentence,
        correctedSentenceEn: breakdown.correctedSentenceEn ?? undefined,
        naturalMeaningVi: breakdown.naturalMeaningVi,
        structureNotesVi: breakdown.structureNotesVi,
        toneOrContextVi: breakdown.toneOrContextVi ?? undefined,
      })),
      keyPhrases: result.keyPhrases.map((phrase) => ({
        phrase: phrase.phrase,
        conceptKey: phrase.conceptKey,
        conceptPhrase: phrase.conceptPhrase,
        conceptMeaningVi: phrase.conceptMeaningVi,
        meaningVi: phrase.meaningVi,
        meaningInContextVi: phrase.meaningInContextVi,
        exampleEn: phrase.exampleEn,
        exampleVi: phrase.exampleVi,
        examples: phrase.examples ?? [],
        literalTranslationVi: phrase.literalTranslationVi ?? undefined,
        naturalTranslationVi: phrase.naturalTranslationVi ?? undefined,
        whyConfusingVi: phrase.whyConfusingVi ?? undefined,
        category: phrase.category,
        difficulty: phrase.difficulty as any,
      })),
      lessonFocuses: result.lessonFocuses.map((focus) => ({
        title: focus.title,
        conceptKey: focus.conceptKey,
        conceptPhrase: focus.conceptPhrase,
        conceptMeaningVi: focus.conceptMeaningVi,
        category: focus.category,
        explanationVi: focus.explanationVi,
        difficulty: focus.difficulty as any,
      })),
    };
  }

  async generateExercises(
    analysis: SaveAnalysisInput,
    onThought?: (text: string) => Promise<void>
  ): Promise<SaveExercisesInput> {
    const result = (await this.llm.generateJson({
      userId: this.userId,
      lessonId: this.lessonId,
      purpose: "exercise_generation",
      prompt: exercisesPrompt(analysis as any),
      promptVersion: PROMPT_VERSIONS.exercises,
      schemaVersion: "exercises",
      schema: exercisesSchema,
      modelKind: "fast",
      onThought,
    })) as ExercisesResult;

    return {
      exercises: result.exercises.map((exercise) => ({
        phrase: "phrase" in exercise ? exercise.phrase : undefined,
        focus: "focus" in exercise ? exercise.focus : undefined,
        type: exercise.type as any,
        promptVi: exercise.promptVi,
        promptEn: "promptEn" in exercise ? exercise.promptEn : undefined,
        choices: "choices" in exercise ? exercise.choices : undefined,
        correctAnswer: "correctAnswer" in exercise ? (exercise.correctAnswer as any) : undefined,
        acceptableAnswers: "acceptableAnswers" in exercise ? exercise.acceptableAnswers : undefined,
        rubricVi: "rubricVi" in exercise ? exercise.rubricVi : undefined,
      })),
    };
  }
}
