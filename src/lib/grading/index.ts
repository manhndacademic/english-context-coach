import type { Exercise } from "@/db/schema";
import { PROMPT_VERSIONS } from "@/domain/constants";
import { generateJson } from "@/lib/ai/provider";
import { gradingPrompt } from "@/lib/ai/prompts";
import { gradingSchema, type GradingResult } from "@/lib/ai/schemas";
import { gradeObjectiveExercise } from "./rules";

export type GradingOutcome =
  | { gradingStatus: "succeeded"; grade: GradingResult }
  | { gradingStatus: "failed"; feedbackVi: string; errorClass: string };

export async function gradeExercise(input: {
  userId: string;
  lessonId: string;
  exercise: Exercise;
  answer: string;
}): Promise<GradingOutcome> {
  const ruleGrade = gradeObjectiveExercise(input.exercise, input.answer);
  if (ruleGrade) return { gradingStatus: "succeeded", grade: ruleGrade };

  try {
    return {
      gradingStatus: "succeeded",
      grade: await generateJson({
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
      }),
    };
  } catch (error) {
    console.error(error);
    return {
      gradingStatus: "failed",
      errorClass: error instanceof Error ? error.name : "UnknownGradingError",
      feedbackVi: "Chưa thể chấm câu trả lời này do phản hồi AI không hợp lệ. Hãy thử gửi lại sau.",
    };
  }
}
