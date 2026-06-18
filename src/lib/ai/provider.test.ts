import { describe, expect, it, afterEach } from "vitest";
import {
  coerceJsonForSchema,
  getGeminiThinkingLevel,
  extractJson,
} from "@/domain/ai/adapters/gemini-utils";
import { generationConfigForPurpose } from "@/domain/ai/adapters/gemini-provider";

describe("AI provider JSON coercion", () => {
  it("wraps top-level exercise arrays in the expected object shape", () => {
    const input = [{ type: "meaning_choice", phrase: "push back" }];
    expect(coerceJsonForSchema(input, "exercises")).toEqual({
      exercises: input,
    });
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
    expect(coerceJsonForSchema([input[0], input[0]], "analysis")).toEqual([
      input[0],
      input[0],
    ]);
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
        "grading"
      )
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
        },
      ],
      sentenceBreakdowns: null, // should be stripped
    };
    expect(coerceJsonForSchema(input, "analysis")).toEqual({
      title: "Nested Null Test",
      keyPhrases: [
        {
          phrase: "test",
          meaningVi: "thử nghiệm",
        },
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
      expect(JSON.parse(extractJson(raw))).toEqual({
        key: { nested: [1, 2, 3] },
        flag: true,
      });
    });
  });
});

describe("Gemini Purpose Generation Config Limits", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  it("should use default max output tokens when no env vars are defined", () => {
    delete process.env.GEMINI_MAX_OUTPUT_TOKENS_ANALYSIS;
    delete process.env.GEMINI_MAX_OUTPUT_TOKENS_EXERCISE;
    delete process.env.GEMINI_MAX_OUTPUT_TOKENS_GRADING;
    delete process.env.GEMINI_MAX_OUTPUT_TOKENS_REPAIR;

    expect(generationConfigForPurpose("analysis").maxOutputTokens).toBe(8192);
    expect(
      generationConfigForPurpose("exercise_generation").maxOutputTokens
    ).toBe(2200);
    expect(generationConfigForPurpose("grading").maxOutputTokens).toBe(4096);
    expect(generationConfigForPurpose("repair").maxOutputTokens).toBe(4096);
  });

  it("should use parsed env values when valid env vars are defined", () => {
    process.env.GEMINI_MAX_OUTPUT_TOKENS_ANALYSIS = "5000";
    process.env.GEMINI_MAX_OUTPUT_TOKENS_EXERCISE = "3000";
    process.env.GEMINI_MAX_OUTPUT_TOKENS_GRADING = "1000";
    process.env.GEMINI_MAX_OUTPUT_TOKENS_REPAIR = "1500";

    expect(generationConfigForPurpose("analysis").maxOutputTokens).toBe(5000);
    expect(
      generationConfigForPurpose("exercise_generation").maxOutputTokens
    ).toBe(3000);
    expect(generationConfigForPurpose("grading").maxOutputTokens).toBe(1000);
    expect(generationConfigForPurpose("repair").maxOutputTokens).toBe(1500);
  });

  it("should fall back to defaults when env vars are non-numeric or invalid", () => {
    process.env.GEMINI_MAX_OUTPUT_TOKENS_ANALYSIS = "abc";
    process.env.GEMINI_MAX_OUTPUT_TOKENS_EXERCISE = "-100";
    process.env.GEMINI_MAX_OUTPUT_TOKENS_GRADING = "0";
    process.env.GEMINI_MAX_OUTPUT_TOKENS_REPAIR = "";

    expect(generationConfigForPurpose("analysis").maxOutputTokens).toBe(8192);
    expect(
      generationConfigForPurpose("exercise_generation").maxOutputTokens
    ).toBe(2200);
    expect(generationConfigForPurpose("grading").maxOutputTokens).toBe(4096);
    expect(generationConfigForPurpose("repair").maxOutputTokens).toBe(4096);
  });
});
