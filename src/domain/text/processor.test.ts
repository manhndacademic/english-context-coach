import { describe, expect, it } from "vitest";
import { DefaultTextProcessor, getHighlightsFromJSON, getPlainTextFromJSON } from "./processor";

describe("DefaultTextProcessor", () => {
  const processor = new DefaultTextProcessor();

  describe("processSource", () => {
    it("processes plain text, normalizing whitespace and hashing content", () => {
      const { normalized, hash } = processor.processSource("  Hello   World! \n  ");
      expect(normalized).toBe("Hello World!");
      expect(hash).toBeDefined();
    });

    it("extracts and processes text from rich editor JSON structures", () => {
      const editorState = JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Rich editor content" }],
          },
        ],
      });
      const { normalized } = processor.processSource(editorState);
      expect(normalized).toBe("Rich editor content");
    });
  });

  describe("normalizePhrase", () => {
    it("standardizes casing, quotes, and multiple spaces", () => {
      expect(processor.normalizePhrase("  \"push   back\"  ")).toBe("push back");
      expect(processor.normalizePhrase("don't")).toBe("dont");
    });
  });

  describe("buildSenseKey", () => {
    it("generates a deterministic 24-character hash key", () => {
      const key1 = processor.buildSenseKey("push back", "hoãn lại", "phrasal_verb");
      const key2 = processor.buildSenseKey("  push   back  ", "  hoãn lại  ", "phrasal_verb");
      expect(key1).toBe(key2);
      expect(key1.length).toBe(24);
    });
  });

  describe("isSafe", () => {
    it("detects emails, urls, proper names, and ticket patterns as sensitive", () => {
      expect(processor.isSafe("test@example.com")).toBe(false);
      expect(processor.isSafe("http://google.com")).toBe(false);
      expect(processor.isSafe("John Doe")).toBe(false);
      expect(processor.isSafe("PROJ-1234")).toBe(false);
      expect(processor.isSafe("project Phoenix")).toBe(false);
      expect(processor.isSafe("This is standard English phrase")).toBe(true);
    });
  });

  describe("getHighlightsFromJSON", () => {
    it("extracts unique highlighted texts from rich editor JSON", () => {
      const node = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "important point",
                marks: [{ type: "highlight" }],
              },
              { type: "text", text: " normal text " },
              {
                type: "text",
                text: "important point",
                marks: [{ type: "highlight" }],
              },
            ],
          },
        ],
      };
      expect(getHighlightsFromJSON(node)).toEqual(["important point"]);
    });
  });
});
