import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Exercise } from "@/db/schema";

const { generateJsonMock } = vi.hoisted(() => ({
  generateJsonMock: vi.fn(),
}));

vi.mock("@/lib/ai/provider", () => ({
  generateJson: generateJsonMock,
}));

const baseExercise: Exercise = {
  id: "exercise-id",
  lessonId: "lesson-id",
  keyPhraseId: null,
  lessonFocusId: null,
  userId: "user-id",
  type: "cloze_phrase",
  promptVi: "Điền cụm còn thiếu.",
  promptEn: "We need to ____ the meeting.",
  choices: null,
  correctAnswer: "push back",
  acceptableAnswers: ["push it back"],
  rubricVi: null,
  orderIndex: 0,
  createdAt: new Date(),
};

describe("gradeExercise", () => {
  beforeEach(() => {
    generateJsonMock.mockReset();
  });

  it("does not call AI for deterministic exercises", async () => {
    const { gradeExercise } = await import("./index");

    const result = await gradeExercise({
      userId: "user-id",
      lessonId: "lesson-id",
      exercise: baseExercise,
      answer: "push back",
    });

    expect(result).toMatchObject({ gradingStatus: "succeeded", grade: { score: 100, isCorrect: true } });
    expect(generateJsonMock).not.toHaveBeenCalled();
  });

  it("uses AI for open-ended exercises", async () => {
    generateJsonMock.mockResolvedValue({
      score: 75,
      isCorrect: false,
      feedbackVi: "Gần đúng, nhưng còn thiếu sắc thái.",
      errorType: "missing_context",
    });
    const { gradeExercise } = await import("./index");

    const result = await gradeExercise({
      userId: "user-id",
      lessonId: "lesson-id",
      exercise: { ...baseExercise, type: "natural_translation", rubricVi: "Chấm nghĩa tự nhiên." },
      answer: "Dời lại cuộc họp.",
    });

    expect(result).toMatchObject({ gradingStatus: "succeeded", grade: { score: 75 } });
    expect(generateJsonMock).toHaveBeenCalledTimes(1);
  });

  it("separates AI grading failure from learner failure", async () => {
    generateJsonMock.mockRejectedValue(new Error("invalid JSON"));
    const { gradeExercise } = await import("./index");

    const result = await gradeExercise({
      userId: "user-id",
      lessonId: "lesson-id",
      exercise: { ...baseExercise, type: "focus_question", rubricVi: "Chấm ngữ cảnh." },
      answer: "Không chắc.",
    });

    expect(result).toMatchObject({ gradingStatus: "failed" });
    expect("grade" in result).toBe(false);
  });
});
