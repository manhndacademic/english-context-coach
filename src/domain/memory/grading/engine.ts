import type { Exercise } from "@/domain/lesson/ports";
import { PROMPT_VERSIONS } from "@/domain/constants";
import type { LLMProvider } from "@/domain/ai";
import { gradingPrompt } from "@/lib/ai/prompts";
import { gradingSchema, type GradingResult } from "@/lib/ai/schemas";
import type { GradingEngine, LearnerGradingResult } from "../ports";

function normalizeAnswer(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Exercise types that require AI grading (free-text production or subjective). */
const AI_GRADED_TYPES: ReadonlySet<string> = new Set([
  "natural_translation",
  "focus_question",
  "phrase_production",
  "dialogue_completion",
  "register_shift",
]);

function gradeObjectiveExercise(
  exercise: Exercise,
  answer: string
): GradingResult | null {
  if (AI_GRADED_TYPES.has(exercise.type)) return null;

  const normalizedAnswer = normalizeAnswer(answer);
  const expected = [
    exercise.correctAnswer,
    ...(exercise.acceptableAnswers ?? []),
  ]
    .filter(Boolean)
    .map((value) => normalizeAnswer(value as string));

  const isCorrect = expected.includes(normalizedAnswer);
  if (!isCorrect) {
    // Return null to fall back to calling the LLM grader for incorrect answers.
    return null;
  }

  return {
    score: 100,
    isCorrect: true,
    feedbackVi: "Đúng. Bạn đã hiểu cụm này theo đúng ngữ cảnh.",
    naturalAnswer: exercise.correctAnswer ?? undefined,
  };
}

export class DefaultGradingEngine implements GradingEngine {
  constructor(private llm: LLMProvider) {}

  async grade(input: {
    userId: string;
    lessonId?: string;
    exercise: Exercise;
    answer: string;
  }): Promise<LearnerGradingResult> {
    const ruleGrade = gradeObjectiveExercise(input.exercise, input.answer);
    if (ruleGrade) {
      return ruleGrade;
    }

    try {
      return await this.llm.generateJson({
        userId: input.userId,
        lessonId: input.lessonId,
        purpose: "grading",
        prompt: gradingPrompt({
          promptEn: input.exercise.promptEn ?? "",
          promptVi: input.exercise.promptVi,
          answer: input.answer,
          rubricVi: input.exercise.rubricVi,
          correctAnswer: input.exercise.correctAnswer,
        }),
        promptVersion: PROMPT_VERSIONS.grading,
        schemaVersion: "grading",
        schema: gradingSchema,
        modelKind: "analysis",
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
