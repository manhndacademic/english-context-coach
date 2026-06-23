import { describe, expect, it } from "vitest";
import { renderRichText, findHighlightRanges } from "./rich-text";
import { renderToStaticMarkup } from "react-dom/server";
import type { KeyPhrase } from "@/domain/lesson";

describe("renderRichText", () => {
  it("should return null for empty inputs", () => {
    expect(renderRichText(null)).toBeNull();
    expect(renderRichText(undefined)).toBeNull();
    expect(renderRichText("")).toBeNull();
  });

  it("should return raw text if no markdown/quotes exist", () => {
    expect(renderRichText("Hello world")).toBe("Hello world");
  });

  it("should parse backticks into inline-phrase code elements", () => {
    const node = renderRichText("Cấu trúc `concerned with` là gì?");
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toBe(
      'Cấu trúc <code class="font-mono text-[0.9em] bg-accent/8 border border-accent/18 text-accent-strong rounded-[4px] px-[5px] py-[1px] font-semibold [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">concerned with</code> là gì?'
    );
  });

  it("should parse bold markdown", () => {
    const node = renderRichText("Đây là **in đậm** nhé.");
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toBe("Đây là <strong>in đậm</strong> nhé.");
  });

  it("should parse italic markdown", () => {
    const node = renderRichText("Đây là *in nghiêng* nhé.");
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toBe("Đây là <em>in nghiêng</em> nhé.");
  });

  it("should parse single quotes with boundaries as inline-phrase code elements", () => {
    const node = renderRichText("Cấu trúc 'concerned with' là gì?");
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toBe(
      'Cấu trúc <code class="font-mono text-[0.9em] bg-accent/8 border border-accent/18 text-accent-strong rounded-[4px] px-[5px] py-[1px] font-semibold [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">concerned with</code> là gì?'
    );
  });

  it("should NOT parse contractions with single quotes like don't or isn't", () => {
    const node = renderRichText("It isn't a problem to use 'ROOTED IN' here.");
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toBe(
      'It isn&#x27;t a problem to use <code class="font-mono text-[0.9em] bg-accent/8 border border-accent/18 text-accent-strong rounded-[4px] px-[5px] py-[1px] font-semibold [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">ROOTED IN</code> here.'
    );
  });

  it("should format inline speaker dialogue labels onto newlines", () => {
    const node = renderRichText("A: Have you finished? B: Yes, I have.");
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toBe(
      "<span>A: Have you finished?</span><br/><span>B: Yes, I have.</span>"
    );
  });

  it("should split single string containing newlines with br tags", () => {
    const node = renderRichText("First line\nSecond line");
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toBe("<span>First line</span><br/><span>Second line</span>");
  });
});

describe("findHighlightRanges", () => {
  const mockPhrases: KeyPhrase[] = [
    {
      id: "phrase-1",
      lessonId: "lesson-1",
      userId: "user-1",
      phrase: "look forward to",
      conceptKey: "look-forward-to",
      conceptPhrase: "look forward to",
      conceptMeaningVi: "mong đợi",
      normalizedPhrase: "look forward to",
      senseKey: "look-forward-to-1",
      meaningVi: "mong đợi",
      meaningInContextVi: "mong đợi",
      category: "phrasal_verb",
      difficulty: "B1",
      isSensitive: false,
      examples: [],
      literalTranslationVi: null,
      naturalTranslationVi: null,
      whyConfusingVi: null,
      createdAt: new Date(),
    },
    {
      id: "phrase-2",
      lessonId: "lesson-1",
      userId: "user-1",
      phrase: "forward",
      conceptKey: "forward",
      conceptPhrase: "forward",
      conceptMeaningVi: "phía trước",
      normalizedPhrase: "forward",
      senseKey: "forward-1",
      meaningVi: "phía trước",
      meaningInContextVi: "phía trước",
      category: "general_phrase",
      difficulty: "A2",
      isSensitive: false,
      examples: [],
      literalTranslationVi: null,
      naturalTranslationVi: null,
      whyConfusingVi: null,
      createdAt: new Date(),
    },
  ];

  it("should match full key phrases case-insensitively and respect word boundaries", () => {
    const text = "We look forward to the meeting.";
    const ranges = findHighlightRanges(text, mockPhrases);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({
      start: 3,
      end: 18,
      phraseId: "phrase-1",
    });
  });

  it("should prioritize longer phrase match over nested shorter phrase match", () => {
    const text = "Please forward it, we look forward to it.";
    const ranges = findHighlightRanges(text, mockPhrases);
    expect(ranges).toHaveLength(2);
    // First match: "forward" at index 7
    expect(ranges[0].phraseId).toBe("phrase-2");
    // Second match: "look forward to" at index 22
    expect(ranges[1].phraseId).toBe("phrase-1");
  });

  it("should NOT match phrases that violate word boundaries", () => {
    const text = "He is lookingforwardto it.";
    const ranges = findHighlightRanges(text, mockPhrases);
    expect(ranges).toHaveLength(0);
  });
});
