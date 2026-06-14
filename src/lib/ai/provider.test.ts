import { describe, expect, it } from "vitest";
import { coerceJsonForSchema, getGeminiThinkingLevel, extractJson } from "@/domain/ai/adapters/gemini-utils";

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
    expect(coerceJsonForSchema(input, "analysis")).toEqual(input[0]);
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

  it("recursively strips null values from nested structures for any schema", () => {
    const input = {
      title: "Nested Null Test",
      keyPhrases: [
        {
          phrase: "test",
          meaningVi: "thử nghiệm",
          whyConfusingVi: null, // should be stripped
        }
      ],
      sentenceBreakdowns: null, // should be stripped
    };
    expect(coerceJsonForSchema(input, "analysis")).toEqual({
      title: "Nested Null Test",
      keyPhrases: [
        {
          phrase: "test",
          meaningVi: "thử nghiệm",
        }
      ],
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

  describe("extractJson", () => {
    it("extracts json inside markdown blocks", () => {
      const raw = '```json\n{"key": "value"}\n```';
      expect(JSON.parse(extractJson(raw))).toEqual({ key: "value" });
    });

    it("extracts json even with trailing garbage braces and brackets", () => {
      const raw = '{"key": "value"}}\n]\n}\n]';
      expect(JSON.parse(extractJson(raw))).toEqual({ key: "value" });
    });

    it("extracts complex nested json structure with trailing garbage", () => {
      const raw = '{"key": {"nested": [1, 2, 3]}, "flag": true}}\n]\n}\n]';
      expect(JSON.parse(extractJson(raw))).toEqual({ key: { nested: [1, 2, 3] }, flag: true });
    });
  });
});
