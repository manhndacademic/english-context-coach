import type { Exercise } from "@/db/schema";

export type RuleGrade = {
  score: number;
  isCorrect: boolean;
  feedbackVi: string;
  naturalAnswer?: string;
  literalTranslationTrap?: string;
  error?: {
    shouldSave: boolean;
    confidence: number;
    errorType:
      | "literal_translation"
      | "phrase_misunderstanding"
      | "technical_term_misunderstanding"
      | "phrasal_verb_error"
      | "collocation_error"
      | "grammar_structure_misread"
      | "pronoun_reference_misread"
      | "tone_register_misread"
      | "missing_context";
    explanationVi: string;
    targetItem: string;
  };
};

function normalizeAnswer(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function gradeObjectiveExercise(exercise: Exercise, answer: string): RuleGrade | null {
  if (exercise.type === "natural_translation" || exercise.type === "focus_question") return null;

  const normalizedAnswer = normalizeAnswer(answer);
  const expected = [exercise.correctAnswer, ...(exercise.acceptableAnswers ?? [])]
    .filter(Boolean)
    .map((value) => normalizeAnswer(value as string));

  const isCorrect = expected.includes(normalizedAnswer);
  return {
    score: isCorrect ? 100 : 0,
    isCorrect,
    feedbackVi: isCorrect
      ? "Đúng. Bạn đã hiểu cụm này theo đúng ngữ cảnh."
      : "Chưa đúng. Hãy chú ý nghĩa của cụm trong câu, không chỉ dịch từng từ.",
    naturalAnswer: exercise.correctAnswer ?? undefined,
    error: isCorrect
      ? undefined
      : {
          shouldSave: true,
          confidence: 100,
          errorType: "phrase_misunderstanding",
          explanationVi: "Câu trả lời chưa khớp với nghĩa tự nhiên trong ngữ cảnh.",
          targetItem: exercise.correctAnswer ?? exercise.promptEn ?? exercise.promptVi,
        },
  };
}
