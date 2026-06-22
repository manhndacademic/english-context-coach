import { z } from "zod";

const textTypeSchema = z.enum([
  "work_message",
  "technical_doc",
  "email",
  "article",
  "academic",
  "general",
  "unknown",
  "chat_message",
  "ticket",
  "code_review",
  "meeting_notes",
]);

export const formalitySchema = z.enum(["formal", "semi_formal", "casual"]);

const inputModeSchema = z.enum([
  "understand_and_practice",
  "fix_and_understand",
  "naturalize_english",
  "mixed_language_support",
  "not_english",
  "developer_error_explanation",
  "unsupported",
]);

const levelSchema = z.enum(["A2", "B1", "B2", "C1"]);
const categorySchema = z.enum([
  "idiom",
  "phrasal_verb",
  "technical_term",
  "collocation",
  "grammar_pattern",
  "business_phrase",
  "general_phrase",
]);
const lessonFocusCategorySchema = z.enum([
  "tone",
  "structure",
  "purpose",
  "context",
]);

const keyPhraseSchema = z.object({
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
      ipa: z.string().optional(),
    })
  ),
  literalTranslationVi: z.string().optional(),
  naturalTranslationVi: z.string().optional(),
  whyConfusingVi: z.string().optional(),
  ipa: z.string().optional(),
  category: categorySchema,
  difficulty: levelSchema,
});

const diffSpanSchema = z.object({
  type: z.enum(["equal", "delete", "insert"]),
  text: z.string(),
});

const sentenceBreakdownSchema = z.object({
  sentence: z.string().min(1),
  correctedSentenceEn: z.string().optional(),
  diffSpans: z.array(diffSpanSchema).optional(),
  naturalMeaningVi: z.string().min(1),
  structureNotesVi: z.string().min(1),
  toneOrContextVi: z.string().optional(),
  ipa: z.string().optional(),
});

const lessonFocusSchema = z.object({
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

const exerciseSchema = z.discriminatedUnion("type", [
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

export type AnalysisResult = z.infer<typeof analysisSchema>;
export type ExercisesResult = z.infer<typeof exercisesSchema>;
export type DiffSpan = z.infer<typeof diffSpanSchema>;

const userErrorTypeSchema = z.enum([
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

const correctionItemSchema = z.object({
  draftPhrase: z.string().min(1),
  correctedPhrase: z.string().min(1),
  explanationVi: z.string().min(1),
  literalTrapVi: z.string().optional().nullable(),
  culturalNoteVi: z.string().optional().nullable(),
  exampleEn: z.string().min(1),
  exampleVi: z.string().min(1),
  category: categorySchema,
  errorType: userErrorTypeSchema,
});

export const diffAnalysisSchema = z.object({
  title: z.string().min(1).max(80),
  textType: textTypeSchema,
  detectedLevel: levelSchema,
  corrections: z.array(correctionItemSchema),
});

export const writingCoachAnalysisSchema = z.object({
  title: z.string().min(1).max(80),
  documentType: textTypeSchema,
  formality: formalitySchema,
  suggestedText: z.string().min(1),
  detectedLevel: levelSchema,
  summaryVi: z.string().min(1),
  naturalTranslationVi: z.string().min(1),
  contextExplanationVi: z.string().min(1),
  toneAnalysisVi: z.string().min(1),
  corrections: z.array(correctionItemSchema),
});

export type DiffAnalysisResult = z.infer<typeof diffAnalysisSchema>;
export type CorrectionItemResult = z.infer<typeof correctionItemSchema>;
export type WritingCoachAnalysisResult = z.infer<
  typeof writingCoachAnalysisSchema
>;
