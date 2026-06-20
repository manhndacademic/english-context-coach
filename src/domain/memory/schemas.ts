import { z } from "zod";

const errorTypeSchema = z.enum([
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

export const gradingSchema = z.object({
  score: z.number().int().min(0).max(100),
  isCorrect: z.boolean(),
  feedbackVi: z.string().min(1).max(3000),
  naturalAnswer: z.string().min(1).max(3000).nullable().optional(),
  literalTranslationTrap: z.string().min(1).max(3000).nullable().optional(),
  feedbackDetails: z
    .object({
      whatWasWrong: z.string().min(1).max(3000),
      whyItWasWrong: z.string().min(1).max(5000),
      correctUnderstanding: z.string().min(1).max(5000),
      mistakeType: z.string().min(1).max(1000),
      nextPracticeItem: z.string().min(1).max(3000).nullable().optional(),
      detailedExplanation: z.string().min(1).max(8000),
    })
    .nullable()
    .optional(),
  error: z
    .object({
      shouldSave: z.boolean(),
      confidence: z.number().int().min(0).max(100),
      errorType: errorTypeSchema.nullable().optional(),
      explanationVi: z.string().min(1).max(5000).nullable().optional(),
      targetItem: z.string().min(1).max(3000).nullable().optional(),
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

export type GradingResult = z.infer<typeof gradingSchema>;
export type ReviewPromptResult = z.infer<typeof reviewPromptSchema>;
