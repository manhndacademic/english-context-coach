import type { Exercise } from "@/db/schema";

export type RuleGrade = {
  score: number;
  isCorrect: boolean;
  feedbackVi: string;
  errorType?: "literal_translation" | "phrase_misunderstanding";
  explanationVi?: string;
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
  if (exercise.type === "natural_translation") return null;

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
    errorType: isCorrect ? undefined : "phrase_misunderstanding",
    explanationVi: isCorrect ? undefined : "Câu trả lời chưa khớp với nghĩa tự nhiên trong ngữ cảnh.",
  };
}
