import { describe, expect, it } from "vitest";
import {
  stripNulls,
  sanitizeValue,
  coerceJsonForSchema,
} from "./jsonSanitizer";

describe("jsonSanitizer", () => {
  describe("stripNulls", () => {
    it("should strip null properties recursively", () => {
      const obj = {
        a: 1,
        b: null,
        c: {
          d: "hello",
          e: null,
        },
      };
      expect(stripNulls(obj)).toEqual({
        a: 1,
        c: {
          d: "hello",
        },
      });
    });
  });

  describe("sanitizeValue", () => {
    it("should strip HTML tags", () => {
      expect(sanitizeValue("<div>Hello</div>")).toBe("Hello");
    });

    it("should convert null placeholders to null", () => {
      expect(sanitizeValue("None")).toBeNull();
      expect(sanitizeValue("null")).toBeNull();
      expect(sanitizeValue("")).toBeNull();
    });

    it("should clean suffix noise", () => {
      expect(sanitizeValue("Correct (null)null,")).toBe("Correct");
    });
  });

  describe("coerceJsonForSchema", () => {
    it("should wrap exercises array in exercises object key", () => {
      const list = [{ id: "ex-1" }];
      expect(coerceJsonForSchema(list, "exercises")).toEqual({
        exercises: [{ id: "ex-1" }],
      });
    });

    it("should extract single item from array for analysis/grading", () => {
      const list = [{ result: "success" }];
      expect(coerceJsonForSchema(list, "grading")).toEqual({
        result: "success",
      });
    });
  });
});
