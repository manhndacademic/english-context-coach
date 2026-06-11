import { describe, expect, it } from "vitest";
import { gradeObjectiveExercise } from "./rules";
import type { Exercise } from "@/db/schema";

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

describe("objective grading", () => {
  it("grades cloze answers by normalized exact match", () => {
    expect(gradeObjectiveExercise(baseExercise, "Push Back")?.isCorrect).toBe(true);
    expect(gradeObjectiveExercise(baseExercise, "push it back")?.isCorrect).toBe(true);
    expect(gradeObjectiveExercise(baseExercise, "delay")?.isCorrect).toBe(false);
  });

  it("leaves natural translation for AI grading", () => {
    expect(gradeObjectiveExercise({ ...baseExercise, type: "natural_translation" }, "Dời lại")).toBeNull();
  });
});
