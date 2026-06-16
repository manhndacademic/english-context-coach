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

export const inputModeSchema = z.enum([
  "understand_and_practice",
  "fix_and_understand",
  "naturalize_english",
  "mixed_language_support",
  "not_english",
  "developer_error_explanation",
  "unsupported",
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
export const lessonFocusCategorySchema = z.enum([
  "tone",
  "structure",
  "purpose",
  "context",
]);

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
  conceptKey: z.string().min(1),
  conceptPhrase: z.string().min(1),
  conceptMeaningVi: z.string().min(1),
  meaningVi: z.string().min(1),
  meaningInContextVi: z.string().min(1),
  examples: z.array(
    z.object({
      exampleEn: z.string().min(1),
      exampleVi: z.string().min(1),
    })
  ),
  literalTranslationVi: z.string().optional(),
  naturalTranslationVi: z.string().optional(),
  whyConfusingVi: z.string().optional(),
  category: categorySchema,
  difficulty: levelSchema,
});

export const diffSpanSchema = z.object({
  type: z.enum(["equal", "delete", "insert"]),
  text: z.string(),
});

export const sentenceBreakdownSchema = z.object({
  sentence: z.string().min(1),
  correctedSentenceEn: z.string().optional(),
  diffSpans: z.array(diffSpanSchema).optional(),
  naturalMeaningVi: z.string().min(1),
  structureNotesVi: z.string().min(1),
  toneOrContextVi: z.string().optional(),
});

export const lessonFocusSchema = z.object({
  title: z.string().min(1).max(80),
  conceptKey: z.string().min(1),
  conceptPhrase: z.string().min(1),
  conceptMeaningVi: z.string().min(1),
  category: lessonFocusCategorySchema,
  explanationVi: z.string().min(1),
  difficulty: levelSchema,
});

export const analysisSchema = z.object({
  title: z.string().min(1).max(80),
  textType: textTypeSchema,
  inputMode: inputModeSchema,
  detectedLevel: levelSchema,
  summaryVi: z.string().min(1),
  naturalTranslationVi: z.string().min(1),
  contextExplanationVi: z.string().min(1),
  sentenceBreakdowns: z.array(sentenceBreakdownSchema).min(0).max(30),
  keyPhrases: z.array(keyPhraseSchema).min(0).max(7),
  lessonFocuses: z.array(lessonFocusSchema).min(0).max(3),
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
  z.object({
    type: z.literal("trap_choice"),
    phrase: z.string().min(1),
    promptVi: z.string().min(1),
    promptEn: z.string().min(1),
    choices: z.array(z.string().min(1)).min(3).max(4),
    correctAnswer: z.string().min(1),
    acceptableAnswers: z.array(z.string().min(1)).optional(),
  }),
  z.object({
    type: z.literal("phrase_production"),
    phrase: z.string().min(1),
    promptVi: z.string().min(1),
    promptEn: z.string().optional(),
    correctAnswer: z.string().min(1),
    acceptableAnswers: z.array(z.string().min(1)).optional(),
    rubricVi: z.string().min(1),
  }),
  z.object({
    type: z.literal("dialogue_completion"),
    phrase: z.string().min(1),
    promptVi: z.string().min(1),
    promptEn: z.string().min(1),
    correctAnswer: z.string().min(1),
    acceptableAnswers: z.array(z.string().min(1)).optional(),
    rubricVi: z.string().min(1),
  }),
  z.object({
    type: z.literal("register_shift"),
    phrase: z.string().min(1),
    promptVi: z.string().min(1),
    promptEn: z.string().min(1),
    correctAnswer: z.string().min(1),
    acceptableAnswers: z.array(z.string().min(1)).optional(),
    rubricVi: z.string().min(1),
  }),
  z.object({
    type: z.literal("trap_detect"),
    phrase: z.string().min(1),
    promptVi: z.string().min(1),
    promptEn: z.string().min(1),
    choices: z.array(z.string().min(1)).min(3).max(4),
    correctAnswer: z.string().min(1),
  }),
]);

export const exercisesSchema = z.object({
  exercises: z.array(exerciseSchema).min(0).max(10),
});

export const gradingSchema = z.object({
  score: z.number().int().min(0).max(100),
  isCorrect: z.boolean(),
  feedbackVi: z.string().min(1).max(300),
  naturalAnswer: z.string().min(1).max(300).nullable().optional(),
  literalTranslationTrap: z.string().min(1).max(300).nullable().optional(),
  feedbackDetails: z
    .object({
      whatWasWrong: z.string().min(1).max(300),
      whyItWasWrong: z.string().min(1).max(500),
      correctUnderstanding: z.string().min(1).max(500),
      mistakeType: z.string().min(1).max(100),
      nextPracticeItem: z.string().min(1).max(300).nullable().optional(),
      detailedExplanation: z.string().min(1).max(800),
    })
    .nullable()
    .optional(),
  error: z
    .object({
      shouldSave: z.boolean(),
      confidence: z.number().int().min(0).max(100),
      errorType: errorTypeSchema.nullable().optional(),
      explanationVi: z.string().min(1).max(500).nullable().optional(),
      targetItem: z.string().min(1).max(200).nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const reviewPromptSchema = z.object({
  reviewType: z.enum([
    "natural_translation",
    "cloze_phrase",
    "dialogue_completion",
    "trap_choice",
    "trap_detect",
  ]),
  reviewPromptEn: z.string().min(1),
  reviewPromptVi: z.string().min(1),
  reviewRubricVi: z.string().min(1),
  reviewCorrectAnswer: z.string().min(1),
  reviewAcceptableAnswers: z.array(z.string().min(1)).min(1).max(5),
  reviewChoices: z.array(z.string().min(1)).min(3).max(4).nullable().optional(),
});

export type AnalysisResult = z.infer<typeof analysisSchema>;
export type ExercisesResult = z.infer<typeof exercisesSchema>;
export type GradingResult = z.infer<typeof gradingSchema>;
export type ReviewPromptResult = z.infer<typeof reviewPromptSchema>;
export type DiffSpan = z.infer<typeof diffSpanSchema>;
