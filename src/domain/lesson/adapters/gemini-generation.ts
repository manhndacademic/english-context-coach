import type { LLMProvider } from "@/domain/ai";
import { AnalysisPrompt, ExercisesPrompt } from "../prompts";
import { type AnalysisResult, type ExercisesResult } from "../schemas";
import type {
  GenerationEngine,
  SaveAnalysisInput,
  SaveExercisesInput,
} from "../ports";
import { cleanEmbeddedQuotesOrBackticks } from "@/lib/utils";

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
    userHighlights?: string[],
    userId?: string,
    lessonId?: string
  ): Promise<SaveAnalysisInput> {
    const activeUserId = userId ?? this.userId;
    const activeLessonId = lessonId ?? this.lessonId;
    const result = (await this.llm.generateJson({
      userId: activeUserId,
      lessonId: activeLessonId,
      prompt: new AnalysisPrompt(sourceText, userHighlights, requestedMode),
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
        correctedSentenceEn: breakdown.correctedSentenceEn
          ? cleanEmbeddedQuotesOrBackticks(breakdown.correctedSentenceEn)
          : undefined,
        diffSpans: breakdown.diffSpans ?? undefined,
        naturalMeaningVi: cleanEmbeddedQuotesOrBackticks(
          breakdown.naturalMeaningVi
        ),
        structureNotesVi: breakdown.structureNotesVi,
        toneOrContextVi: breakdown.toneOrContextVi ?? undefined,
        ipa: breakdown.ipa ?? undefined,
      })),
      keyPhrases: result.keyPhrases.map((phrase) => ({
        phrase: phrase.phrase,
        conceptKey: phrase.conceptKey,
        conceptPhrase: phrase.conceptPhrase,
        conceptMeaningVi: phrase.conceptMeaningVi,
        meaningVi: phrase.meaningVi,
        meaningInContextVi: phrase.meaningInContextVi,
        examples: (phrase.examples ?? []).map((ex) => ({
          exampleEn: cleanEmbeddedQuotesOrBackticks(ex.exampleEn),
          exampleVi: cleanEmbeddedQuotesOrBackticks(ex.exampleVi),
          ipa: ex.ipa ?? undefined,
        })),
        literalTranslationVi: phrase.literalTranslationVi ?? undefined,
        naturalTranslationVi: phrase.naturalTranslationVi ?? undefined,
        whyConfusingVi: phrase.whyConfusingVi ?? undefined,
        ipa: phrase.ipa ?? undefined,
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
    onThought?: (text: string) => Promise<void>,
    userId?: string,
    lessonId?: string,
    activeMistakePatterns?: Array<{ conceptKey: string; category: string }>
  ): Promise<SaveExercisesInput> {
    const activeUserId = userId ?? this.userId;
    const activeLessonId = lessonId ?? this.lessonId;
    const result = (await this.llm.generateJson({
      userId: activeUserId,
      lessonId: activeLessonId,
      prompt: new ExercisesPrompt(analysis as any, activeMistakePatterns),
      onThought,
    })) as ExercisesResult;

    return {
      exercises: result.exercises.map((exercise) => ({
        phrase: "phrase" in exercise ? exercise.phrase : undefined,
        focus: "focus" in exercise ? exercise.focus : undefined,
        type: exercise.type as any,
        promptVi: exercise.promptVi,
        promptEn:
          "promptEn" in exercise && exercise.promptEn
            ? cleanEmbeddedQuotesOrBackticks(exercise.promptEn)
            : undefined,
        choices:
          "choices" in exercise && exercise.choices
            ? exercise.choices.map((c) => cleanEmbeddedQuotesOrBackticks(c))
            : undefined,
        correctAnswer:
          "correctAnswer" in exercise &&
          typeof exercise.correctAnswer === "string"
            ? cleanEmbeddedQuotesOrBackticks(exercise.correctAnswer)
            : "correctAnswer" in exercise
              ? exercise.correctAnswer
              : undefined,
        acceptableAnswers:
          "acceptableAnswers" in exercise && exercise.acceptableAnswers
            ? exercise.acceptableAnswers.map((a) =>
                cleanEmbeddedQuotesOrBackticks(a)
              )
            : undefined,
        rubricVi: "rubricVi" in exercise ? exercise.rubricVi : undefined,
      })),
    };
  }
}
