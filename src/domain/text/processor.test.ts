import { describe, expect, it } from "vitest";
import {
  DefaultTextProcessor,
  getHighlightsFromJSON,
  getPlainTextFromJSON,
} from "./processor";

describe("DefaultTextProcessor", () => {
  const processor = new DefaultTextProcessor();

  describe("processSource", () => {
    it("processes plain text, normalizing whitespace and hashing content", () => {
      const { normalized, hash } = processor.processSource(
        "  Hello   World! \n  "
      );
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
      expect(processor.normalizePhrase('  "push   back"  ')).toBe("push back");
      expect(processor.normalizePhrase("don't")).toBe("dont");
    });
  });

  describe("buildSenseKey", () => {
    it("generates a deterministic 24-character hash key", () => {
      const key1 = processor.buildSenseKey(
        "push back",
        "hoãn lại",
        "phrasal_verb"
      );
      const key2 = processor.buildSenseKey(
        "  push   back  ",
        "  hoãn lại  ",
        "phrasal_verb"
      );
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

  describe("shouldScrubMistakePattern", () => {
    it("scrubs when the phrase is sensitive", () => {
      expect(
        processor.shouldScrubMistakePattern({
          phrase: "John Doe",
          meaningVi: "Người ẩn danh",
          safeReviewPromptVi: "Ôn lại cụm john doe",
        })
      ).toBe(true);
    });

    it("scrubs when the meaning is sensitive", () => {
      expect(
        processor.shouldScrubMistakePattern({
          phrase: "secret",
          meaningVi: "Thoại với John Doe",
          safeReviewPromptVi: "Ôn lại cụm secret",
        })
      ).toBe(true);
    });

    it("does not scrub safe phrases", () => {
      expect(
        processor.shouldScrubMistakePattern({
          phrase: "push back",
          meaningVi: "trì hoãn",
          safeReviewPromptVi: "Ôn lại cụm push back",
        })
      ).toBe(false);
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

    it("merges contiguous highlighted text nodes containing inline formatting marks", () => {
      const node = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "look ",
                marks: [{ type: "highlight" }],
              },
              {
                type: "text",
                text: "forward",
                marks: [{ type: "highlight" }, { type: "bold" }],
              },
              {
                type: "text",
                text: " to",
                marks: [{ type: "highlight" }],
              },
            ],
          },
        ],
      };
      expect(getHighlightsFromJSON(node)).toEqual(["look forward to"]);
    });

    it("keeps highlights separate if they are divided by unhighlighted whitespace", () => {
      const node = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "look",
                marks: [{ type: "highlight" }],
              },
              {
                type: "text",
                text: " ",
              },
              {
                type: "text",
                text: "forward",
                marks: [{ type: "highlight" }],
              },
            ],
          },
        ],
      };
      expect(getHighlightsFromJSON(node)).toEqual(["look", "forward"]);
    });

    it("keeps highlights separate if they are in different paragraphs", () => {
      const node = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Hello",
                marks: [{ type: "highlight" }],
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "World",
                marks: [{ type: "highlight" }],
              },
            ],
          },
        ],
      };
      expect(getHighlightsFromJSON(node)).toEqual(["Hello", "World"]);
    });
  });

  describe("getPlainTextFromJSON", () => {
    it("joins block containers like listItem and blockquote with newlines to avoid squishing", () => {
      const node = {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Item 1 Line A" }],
                  },
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Item 1 Line B" }],
                  },
                ],
              },
            ],
          },
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Quote 1" }],
              },
              {
                type: "paragraph",
                content: [{ type: "text", text: "Quote 2" }],
              },
            ],
          },
        ],
      };
      const text = getPlainTextFromJSON(node);
      expect(text).toContain("Item 1 Line A\nItem 1 Line B");
      expect(text).toContain("Quote 1\nQuote 2");
    });

    it("converts hardBreak nodes to newlines", () => {
      const node = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "First line" },
              { type: "hardBreak" },
              { type: "text", text: "Second line" },
            ],
          },
        ],
      };
      const text = getPlainTextFromJSON(node);
      expect(text).toBe("First line\nSecond line");
    });
  });
});
