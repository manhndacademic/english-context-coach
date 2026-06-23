import type { LLMProvider } from "@/domain/ai";
import {
  AnalysisPrompt,
  ExercisesPrompt,
  DiffExercisesPrompt,
  WritingCoachPrompt,
} from "../prompts";
import {
  generateDiffAnalysis as runDiffEngine,
  diffWords,
  extractDiffPairs,
} from "../diff-engine";
import {
  type AnalysisResult,
  type ExercisesResult,
  type WritingCoachAnalysisResult,
} from "../schemas";
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

  async generateDiffAnalysis(
    draftText: string,
    sourceText: string,
    onThought?: (text: string) => Promise<void>,
    userId?: string,
    lessonId?: string
  ): Promise<SaveAnalysisInput> {
    const activeUserId = userId ?? this.userId;
    const activeLessonId = lessonId ?? this.lessonId;
    return runDiffEngine({
      draftText,
      sourceText,
      llm: this.llm,
      userId: activeUserId,
      lessonId: activeLessonId,
      onThought,
    });
  }

  async generateWritingCoachAnalysis(
    draftText: string,
    onThought?: (text: string) => Promise<void>,
    userId?: string,
    lessonId?: string
  ): Promise<SaveAnalysisInput> {
    const activeUserId = userId ?? this.userId;
    const activeLessonId = lessonId ?? this.lessonId;

    const result = (await this.llm.generateJson({
      userId: activeUserId,
      lessonId: activeLessonId,
      prompt: new WritingCoachPrompt(draftText),
      onThought,
    })) as WritingCoachAnalysisResult;

    // Deterministic diffing to confirm changes exist
    const diffs = diffWords(draftText, result.suggestedText);
    const rawPairs = extractDiffPairs(diffs);

    if (rawPairs.length === 0) {
      return this.generateAnalysis(
        draftText,
        onThought,
        "understand_and_practice",
        [],
        activeUserId,
        activeLessonId
      );
    }

    return {
      title: result.title || "Bài học sửa lỗi",
      textType: result.documentType as any,
      formality: result.formality as any,
      suggestedText: result.suggestedText,
      inputMode: "write",
      detectedLevel: result.detectedLevel as any,
      summaryVi: result.summaryVi,
      naturalTranslationVi: result.naturalTranslationVi,
      contextExplanationVi:
        result.toneAnalysisVi || result.contextExplanationVi,
      keyPhrases: [],
      sentenceBreakdowns: [],
      lessonFocuses: [],
      correctionItems: (result.corrections ?? []).map((item) => ({
        draftPhrase: cleanEmbeddedQuotesOrBackticks(item.draftPhrase),
        correctedPhrase: cleanEmbeddedQuotesOrBackticks(item.correctedPhrase),
        explanationVi: item.explanationVi,
        literalTrapVi: item.literalTrapVi || null,
        culturalNoteVi: item.culturalNoteVi || null,
        exampleEn: cleanEmbeddedQuotesOrBackticks(item.exampleEn),
        exampleVi: cleanEmbeddedQuotesOrBackticks(item.exampleVi),
        category: item.category,
        errorType: item.errorType,
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
    const prompt =
      analysis.inputMode === "diff" || analysis.inputMode === "write"
        ? new DiffExercisesPrompt(analysis, activeMistakePatterns)
        : new ExercisesPrompt(analysis as any, activeMistakePatterns);

    const result = (await this.llm.generateJson({
      userId: activeUserId,
      lessonId: activeLessonId,
      prompt,
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
