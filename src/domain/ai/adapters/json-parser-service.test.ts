import { describe, expect, it } from "vitest";
import { JsonParserService } from "./json-parser-service";

describe("JsonParserService", () => {
  describe("extractJson", () => {
    it("should extract JSON object directly", () => {
      const raw = '   {"key": "value"}   ';
      expect(JsonParserService.extractJson(raw)).toBe('{"key": "value"}');
    });

    it("should extract JSON array directly", () => {
      const raw = '   ["a", "b"]   ';
      expect(JsonParserService.extractJson(raw)).toBe('["a", "b"]');
    });

    it("should extract JSON from inside markdown fences", () => {
      const raw =
        'Here is the response:\n```json\n{\n  "key": "value"\n}\n```\nSome other text.';
      expect(JsonParserService.extractJson(raw)).toBe('{\n  "key": "value"\n}');
    });

    it("should extract JSON from inside markdown fences without json identifier", () => {
      const raw = '```\n["a", "b"]\n```';
      expect(JsonParserService.extractJson(raw)).toBe('["a", "b"]');
    });

    it("should handle nested braces correctly to find outer boundary", () => {
      const raw = '{"a": {"b": 1}} rest of the text';
      expect(JsonParserService.extractJson(raw)).toBe('{"a": {"b": 1}}');
    });
  });

  describe("repairJson", () => {
    it("should strip trailing commas from arrays", () => {
      const raw = "[1, 2, 3, ]";
      expect(JsonParserService.repairJson(raw)).toBe("[1, 2, 3 ]");
    });

    it("should strip trailing commas from objects", () => {
      const raw = '{"a": 1, "b": 2, }';
      expect(JsonParserService.repairJson(raw)).toBe('{"a": 1, "b": 2 }');
    });

    it("should not strip commas inside string values", () => {
      const raw = '{"a": "hello, }world"}';
      expect(JsonParserService.repairJson(raw)).toBe('{"a": "hello, }world"}');
    });

    it("should escape literal newlines, carriage returns, and tabs inside strings", () => {
      const raw = '{"a": "line1\nline2\rline3\tline4"}';
      expect(JsonParserService.repairJson(raw)).toBe(
        '{"a": "line1\\nline2\\rline3\\tline4"}'
      );
    });

    it("should escape unescaped double quotes inside string values", () => {
      const raw = '{"explanationVi": "Nghĩa của từ "phrasal verb" là..."}';
      expect(JsonParserService.repairJson(raw)).toBe(
        '{"explanationVi": "Nghĩa của từ \\"phrasal verb\\" là..."}'
      );
    });

    it("should not escape valid closing quotes", () => {
      const raw = '{"a": "value", "b": "another"}';
      expect(JsonParserService.repairJson(raw)).toBe(
        '{"a": "value", "b": "another"}'
      );
    });
  });

  describe("coerceJsonForSchema", () => {
    it("should strip null values recursively", () => {
      const input = { a: 1, b: null, c: { d: "hello", e: null } };
      const output = JsonParserService.coerceJsonForSchema(input, "analysis");
      expect(output).toEqual({ a: 1, c: { d: "hello" } });
    });

    it("should wrap exercises array in an object", () => {
      const input = [{ phrase: "hello" }];
      const output = JsonParserService.coerceJsonForSchema(input, "exercises");
      expect(output).toEqual({ exercises: [{ phrase: "hello" }] });
    });

    it("should unpack single-item arrays for analysis schema", () => {
      const input = [{ title: "My Lesson" }];
      const output = JsonParserService.coerceJsonForSchema(input, "analysis");
      expect(output).toEqual({ title: "My Lesson" });
    });

    it("should clean grading schemas nulls/empty strings/none", () => {
      const input = {
        isCorrect: false,
        naturalAnswer: "none",
        errorType: "",
        explanationVi: null,
        error: {
          shouldSave: true,
          errorType: "none",
          explanationVi: "",
        },
      };
      const output = JsonParserService.coerceJsonForSchema(input, "grading");
      expect(output).toEqual({
        isCorrect: false,
        error: {
          shouldSave: true,
        },
      });
    });

    it("should delete nested error if isCorrect is true in grading schema", () => {
      const input = {
        isCorrect: true,
        error: {
          shouldSave: true,
          errorType: "literal_translation",
        },
      };
      const output = JsonParserService.coerceJsonForSchema(input, "grading");
      expect(output).toEqual({
        isCorrect: true,
      });
    });

    it("should strip HTML tags from string values", () => {
      const input = {
        feedbackVi: "<p>Bạn cần dùng 'quyền xem' thay vì 'quyền để xem'.</p>",
        naturalAnswer: "<span>Clean text</span>",
      };
      const output = JsonParserService.coerceJsonForSchema(input, "grading");
      expect(output.feedbackVi).toBe(
        "Bạn cần dùng 'quyền xem' thay vì 'quyền để xem'."
      );
      expect(output.naturalAnswer).toBe("Clean text");
    });

    it("should remove garbage suffix and prefix (null)null,", () => {
      const input = {
        naturalAnswer:
          "Bạn cần yêu cầu quyền xem các tệp tài chính hạn chế trong thư mục dùng chung. (null)null,",
        literalTranslationTrap: "  (null)null,   ",
      };
      const output = JsonParserService.coerceJsonForSchema(input, "grading");
      expect(output.naturalAnswer).toBe(
        "Bạn cần yêu cầu quyền xem các tệp tài chính hạn chế trong thư mục dùng chung."
      );
      expect(output.literalTranslationTrap).toBeUndefined();
    });

    it("should convert literal string placeholders to null and strip them", () => {
      const input = {
        literalTranslationTrap: "null",
        error: {
          shouldSave: true,
          confidence: 80,
          errorType: "none",
          explanationVi: "undefined",
          targetItem: "(null)",
        },
      };
      const output = JsonParserService.coerceJsonForSchema(input, "grading");
      expect(output.literalTranslationTrap).toBeUndefined();
      // Since errorType, explanationVi, targetItem are all stripped, and shouldSave is true,
      // it keeps only shouldSave and confidence
      expect(output.error).toEqual({
        shouldSave: true,
        confidence: 80,
      });
    });

    it("should strip swallowed technical json noise and keys from string values", () => {
      const input = {
        naturalAnswer:
          'Chúng tôi đã lắp đặt hệ thống cảnh báo động mới để ngăn chặn burglars vào nhà.literalTranslationTrap: null, feedbackDetails: { whatWasWrong: "Sử dụng từ tránh và cần dịch từ burglars" }',
      };
      const output = JsonParserService.coerceJsonForSchema(input, "grading");
      expect(output.naturalAnswer).toBe(
        "Chúng tôi đã lắp đặt hệ thống cảnh báo động mới để ngăn chặn burglars vào nhà."
      );
    });
  });

  describe("parse", () => {
    it("should parse and repair complex malformed JSON", () => {
      const malformed = `
        \`\`\`json
        {
          "title": "Clean Title",
          "detectedLevel": "B1",
          "summaryVi": "Tóm tắt: "nội dung" bài học,",
          "naturalTranslationVi": "Dịch tự nhiên\\ntrong ngữ cảnh",
        }
        \`\`\`
      `;
      const result = JsonParserService.parse<{
        title: string;
        detectedLevel: string;
        summaryVi: string;
        naturalTranslationVi: string;
      }>(malformed, "analysis");

      expect(result).toEqual({
        title: "Clean Title",
        detectedLevel: "B1",
        summaryVi: 'Tóm tắt: "nội dung" bài học,',
        naturalTranslationVi: "Dịch tự nhiên\ntrong ngữ cảnh",
      });
    });
  });
});
