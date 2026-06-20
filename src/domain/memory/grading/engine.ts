import type { LLMProvider } from "@/domain/ai";
import { GradingPrompt } from "../prompts";
import type {
  GradingEngine,
  LearnerGradingResult,
  GradableExercise,
} from "../ports";

function normalizeAnswer(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function gradeObjectiveExercise(
  exercise: GradableExercise,
  answer: string
): LearnerGradingResult | null {
  const isMultipleChoice =
    exercise.type === "meaning_choice" ||
    exercise.type === "trap_choice" ||
    exercise.type === "trap_detect";

  const isCloze = exercise.type === "cloze_phrase";

  if (!isMultipleChoice && !isCloze) return null;

  const normalizedAnswer = normalizeAnswer(answer);
  const expected: string[] = [];
  const candidates = [
    exercise.correctAnswer,
    ...(exercise.acceptableAnswers ?? []),
  ];
  for (const value of candidates) {
    if (value) {
      expected.push(normalizeAnswer(value as string));
    }
  }

  const isCorrect = expected.includes(normalizedAnswer);

  if (isCorrect) {
    return {
      score: 100,
      isCorrect: true,
      feedbackVi: exercise.rubricVi ?? "Chính xác! Bạn đã chọn đáp án đúng.",
      naturalAnswer: exercise.correctAnswer ?? undefined,
    };
  }

  // If incorrect and fill-in-the-blank, fall back to AI to analyze morphology/spelling
  if (isCloze) {
    return null;
  }

  // Otherwise, it is an incorrect multiple-choice, grade locally as incorrect
  return {
    score: 0,
    isCorrect: false,
    feedbackVi:
      exercise.rubricVi ?? "Chưa chính xác. Vui lòng chọn lại đáp án đúng.",
    naturalAnswer: exercise.correctAnswer ?? undefined,
    error: {
      shouldSave: true,
      confidence: 1,
      errorType: "phrase_misunderstanding",
      explanationVi:
        exercise.rubricVi ?? "Nhầm lẫn nghĩa hoặc cách dùng cụm từ.",
      targetItem:
        exercise.correctAnswer ?? exercise.promptEn ?? exercise.promptVi,
    },
  };
}

export class DefaultGradingEngine implements GradingEngine {
  constructor(private llm: LLMProvider) {}

  async grade(input: {
    userId: string;
    lessonId?: string;
    exercise: GradableExercise;
    answer: string;
  }): Promise<LearnerGradingResult> {
    const ruleGrade = gradeObjectiveExercise(input.exercise, input.answer);
    if (ruleGrade) {
      // Return local grade immediately without calling the LLM
      return ruleGrade;
    }

    try {
      return await this.llm.generateJson({
        userId: input.userId,
        lessonId: input.lessonId,
        prompt: new GradingPrompt({
          promptEn: input.exercise.promptEn ?? "",
          promptVi: input.exercise.promptVi,
          answer: input.answer,
          rubricVi: input.exercise.rubricVi,
          correctAnswer: input.exercise.correctAnswer,
        }),
      });
    } catch (error) {
      console.error("[GradingEngine] AI grading call failed:", error);
      return {
        score: 0,
        isCorrect: false,
        systemFailure: true,
        feedbackVi:
          "Chưa thể chấm câu trả lời này do phản hồi AI không hợp lệ. Hãy thử gửi lại sau.",
        error: {
          shouldSave: false,
          confidence: 0,
          errorType: "phrase_misunderstanding",
          explanationVi:
            "Hệ thống không nhận được phản hồi chấm điểm đúng định dạng.",
          targetItem:
            input.exercise.correctAnswer ??
            input.exercise.promptEn ??
            input.exercise.promptVi,
        },
      };
    }
  }
}
