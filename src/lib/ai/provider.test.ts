import { describe, expect, it } from "vitest";
import { coerceJsonForSchema, getGeminiThinkingLevel } from "./provider";

describe("AI provider JSON coercion", () => {
  it("wraps top-level exercise arrays in the expected object shape", () => {
    const input = [{ type: "meaning_choice", phrase: "push back" }];
    expect(coerceJsonForSchema(input, "exercises")).toEqual({ exercises: input });
  });

  it("unwraps single-object analysis arrays", () => {
    const input = [
      {
        title: "Lesson",
        textType: "work_message",
        detectedLevel: "B1",
        summaryVi: "Summary",
        naturalTranslationVi: "Translation",
        contextExplanationVi: "Context",
        keyPhrases: [],
      },
    ];
    expect(coerceJsonForSchema(input, "analysis")).toBe(input[0]);
  });

  it("leaves multi-item non-exercise arrays unchanged", () => {
    const input = [{ title: "not valid analysis" }];
    expect(coerceJsonForSchema([input[0], input[0]], "analysis")).toEqual([input[0], input[0]]);
  });

  it("removes null optional grading fields before schema validation", () => {
    expect(
      coerceJsonForSchema(
        {
          score: 80,
          isCorrect: false,
          feedbackVi: "Gần đúng.",
          errorType: null,
          explanationVi: "",
        },
        "grading",
      ),
    ).toEqual({
      score: 80,
      isCorrect: false,
      feedbackVi: "Gần đúng.",
    });
  });

  it("normalizes supported Gemini thinking levels from the environment", () => {
    const original = process.env.GEMINI_THINKING_LEVEL;
    process.env.GEMINI_THINKING_LEVEL = "medium";
    expect(getGeminiThinkingLevel()).toBe("MEDIUM");

    process.env.GEMINI_THINKING_LEVEL = "unsupported";
    expect(getGeminiThinkingLevel()).toBe("MINIMAL");

    process.env.GEMINI_THINKING_LEVEL = original;
  });
});
