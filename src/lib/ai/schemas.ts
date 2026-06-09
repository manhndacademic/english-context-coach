import { z } from "zod";

export const textTypeSchema = z.enum([
  "work_message",
  "technical_doc",
  "email",
  "article",
  "academic",
  "general",
  "unknown",
]);

export const levelSchema = z.enum(["A2", "B1", "B2", "C1"]);
export const categorySchema = z.enum([
  "idiom",
  "phrasal_verb",
  "technical_term",
  "collocation",
  "grammar_pattern",
  "business_phrase",
  "general_phrase",
]);
export const lessonFocusCategorySchema = z.enum(["tone", "structure", "purpose", "context"]);

export const errorTypeSchema = z.enum([
  "literal_translation",
  "phrase_misunderstanding",
  "technical_term_misunderstanding",
  "phrasal_verb_error",
  "collocation_error",
  "grammar_structure_misread",
  "pronoun_reference_misread",
  "tone_register_misread",
  "missing_context",
]);

export const keyPhraseSchema = z.object({
  phrase: z.string().min(1),
  meaningVi: z.string().min(1),
  meaningInContextVi: z.string().min(1),
  exampleEn: z.string().min(1),
  exampleVi: z.string().min(1),
  literalTranslationVi: z.string().optional(),
  naturalTranslationVi: z.string().optional(),
  whyConfusingVi: z.string().optional(),
  category: categorySchema,
  difficulty: levelSchema,
});

export const sentenceBreakdownSchema = z.object({
  sentence: z.string().min(1),
  naturalMeaningVi: z.string().min(1),
  structureNotesVi: z.string().min(1),
  toneOrContextVi: z.string().optional(),
});

export const lessonFocusSchema = z.object({
  title: z.string().min(1).max(80),
  category: lessonFocusCategorySchema,
  explanationVi: z.string().min(1),
  difficulty: levelSchema,
});

export const analysisSchema = z.object({
  title: z.string().min(1).max(80),
  textType: textTypeSchema,
  detectedLevel: levelSchema,
  summaryVi: z.string().min(1),
  naturalTranslationVi: z.string().min(1),
  contextExplanationVi: z.string().min(1),
  sentenceBreakdowns: z.array(sentenceBreakdownSchema).min(1).max(12),
  keyPhrases: z.array(keyPhraseSchema).min(1).max(7),
  lessonFocuses: z.array(lessonFocusSchema).min(1).max(3),
});

export const exerciseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("meaning_choice"),
    phrase: z.string().min(1),
    promptVi: z.string().min(1),
    choices: z.array(z.string().min(1)).min(3).max(4),
    correctAnswer: z.string().min(1),
  }),
  z.object({
    type: z.literal("cloze_phrase"),
    phrase: z.string().min(1),
    promptVi: z.string().min(1),
    promptEn: z.string().min(1),
    correctAnswer: z.string().min(1),
    acceptableAnswers: z.array(z.string().min(1)).min(1).max(5),
  }),
  z.object({
    type: z.literal("natural_translation"),
    phrase: z.string().min(1),
    promptVi: z.string().min(1),
    promptEn: z.string().min(1),
    rubricVi: z.string().min(1),
  }),
  z.object({
    type: z.literal("focus_question"),
    focus: z.string().min(1),
    promptVi: z.string().min(1),
    promptEn: z.string().optional(),
    rubricVi: z.string().min(1),
  }),
]);

export const exercisesSchema = z.object({
  exercises: z.array(exerciseSchema).min(3).max(7),
});

export const gradingSchema = z.object({
  score: z.number().int().min(0).max(100),
  isCorrect: z.boolean(),
  feedbackVi: z.string().min(1),
  errorType: errorTypeSchema.optional(),
  explanationVi: z.string().optional(),
});

export type AnalysisResult = z.infer<typeof analysisSchema>;
export type ExercisesResult = z.infer<typeof exercisesSchema>;
export type GradingResult = z.infer<typeof gradingSchema>;
