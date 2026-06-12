import { describe, expect, it } from "vitest";
import { gradeObjectiveExercise } from "./rules";

describe("gradeObjectiveExercise rules", () => {
  it("returns null for natural_translation and focus_question", () => {
    const exercise = { type: "natural_translation" } as any;
    expect(gradeObjectiveExercise(exercise, "test")).toBeNull();
  });

  it("grades correct answers successfully (meaning_choice)", () => {
    const exercise = {
      type: "meaning_choice",
      correctAnswer: "Ổn rồi",
      acceptableAnswers: ["Được rồi"],
    } as any;
    
    const result = gradeObjectiveExercise(exercise, "Ổn rồi");
    expect(result).not.toBeNull();
    expect(result?.isCorrect).toBe(true);
    expect(result?.score).toBe(100);

    const resultAcceptable = gradeObjectiveExercise(exercise, "Được rồi");
    expect(resultAcceptable?.isCorrect).toBe(true);
  });

  it("grades incorrect answers and returns error data", () => {
    const exercise = {
      type: "meaning_choice",
      correctAnswer: "Ổn rồi",
      promptVi: "Hỏi",
      promptEn: "Prompt",
    } as any;
    
    const result = gradeObjectiveExercise(exercise, "Nhìn đẹp");
    expect(result).not.toBeNull();
    expect(result?.isCorrect).toBe(false);
    expect(result?.score).toBe(0);
    expect(result?.error?.shouldSave).toBe(true);
    expect(result?.error?.errorType).toBe("phrase_misunderstanding");
  });
});
