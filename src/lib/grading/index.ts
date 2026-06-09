import type { Exercise } from "@/db/schema";
import { PROMPT_VERSIONS } from "@/domain/constants";
import { generateJson } from "@/lib/ai/provider";
import { gradingPrompt } from "@/lib/ai/prompts";
import { gradingSchema, type GradingResult } from "@/lib/ai/schemas";
import { gradeObjectiveExercise } from "./rules";

export async function gradeExercise(input: {
  userId: string;
  lessonId: string;
  exercise: Exercise;
  answer: string;
}): Promise<GradingResult> {
  const ruleGrade = gradeObjectiveExercise(input.exercise, input.answer);
  if (ruleGrade) return ruleGrade;

  try {
    return await generateJson({
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
    console.error(error);
    return {
      score: 0,
      isCorrect: false,
      feedbackVi: "Chưa thể chấm câu trả lời này do phản hồi AI không hợp lệ. Hãy thử gửi lại sau.",
      explanationVi: "Hệ thống không nhận được phản hồi chấm điểm đúng định dạng.",
    };
  }
}
