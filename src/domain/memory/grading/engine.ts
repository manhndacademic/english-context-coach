import type { Exercise } from "@/db/schema";
import { PROMPT_VERSIONS } from "@/domain/constants";
import type { LLMProvider } from "@/domain/ai";
import { gradingPrompt } from "@/lib/ai/prompts";
import { gradingSchema, type GradingResult } from "@/lib/ai/schemas";
import { gradeObjectiveExercise } from "./rules";
import type { GradingEngine } from "../ports";

export class DefaultGradingEngine implements GradingEngine {
  constructor(private llm: LLMProvider) {}

  async grade(input: {
    userId: string;
    lessonId?: string;
    exercise: Exercise;
    answer: string;
  }): Promise<GradingResult> {
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
        feedbackVi: "Chưa thể chấm câu trả lời này do phản hồi AI không hợp lệ. Hãy thử gửi lại sau.",
        error: {
          shouldSave: false,
          confidence: 0,
          errorType: "phrase_misunderstanding",
          explanationVi: "Hệ thống không nhận được phản hồi chấm điểm đúng định dạng.",
          targetItem: input.exercise.correctAnswer ?? input.exercise.promptEn ?? input.exercise.promptVi,
        },
      };
    }
  }
}
