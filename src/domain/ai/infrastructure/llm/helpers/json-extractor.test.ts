import { describe, expect, it } from "vitest";
import { extractJson, cleanJsonString } from "./json-extractor";

describe("jsonExtractor", () => {
  describe("cleanJsonString", () => {
    it("should return same string if no braces/brackets", () => {
      expect(cleanJsonString("no braces")).toBe("no braces");
    });

    it("should extract outer object boundary", () => {
      expect(cleanJsonString('some prefix {"foo": "bar"} suffix')).toBe(
        '{"foo": "bar"}'
      );
    });

    it("should ignore braces inside strings", () => {
      expect(cleanJsonString('{"foo": "bar } } baz"}')).toBe(
        '{"foo": "bar } } baz"}'
      );
    });

    it("should extract arrays correctly", () => {
      expect(cleanJsonString("  [1, 2, 3] ignored suffix")).toBe("[1, 2, 3]");
    });
  });

  describe("extractJson", () => {
    it("should extract JSON from markdown block", () => {
      const md =
        'Here is your JSON:\n```json\n{\n  "hello": "world"\n}\n```\nHope it helps!';
      expect(extractJson(md)).toBe('{\n  "hello": "world"\n}');
    });

    it("should handle markdown block without json specifier", () => {
      const md = "```\n[1, 2, 3]\n```";
      expect(extractJson(md)).toBe("[1, 2, 3]");
    });
  });
});
