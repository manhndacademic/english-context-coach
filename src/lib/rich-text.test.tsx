import React from "react";
import { describe, expect, it } from "vitest";
import { renderRichText } from "./rich-text";
import { renderToStaticMarkup } from "react-dom/server";

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
    expect(html).toBe('Cấu trúc <code class="font-mono text-[0.9em] bg-accent/8 border border-accent/18 text-accent-strong rounded-[4px] px-[5px] py-[1px] font-semibold [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">concerned with</code> là gì?');
  });

  it("should parse bold markdown", () => {
    const node = renderRichText("Đây là **in đậm** nhé.");
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toBe('Đây là <strong>in đậm</strong> nhé.');
  });

  it("should parse italic markdown", () => {
    const node = renderRichText("Đây là *in nghiêng* nhé.");
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toBe('Đây là <em>in nghiêng</em> nhé.');
  });

  it("should parse single quotes with boundaries as inline-phrase code elements", () => {
    const node = renderRichText("Cấu trúc 'concerned with' là gì?");
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toBe('Cấu trúc <code class="font-mono text-[0.9em] bg-accent/8 border border-accent/18 text-accent-strong rounded-[4px] px-[5px] py-[1px] font-semibold [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">concerned with</code> là gì?');
  });

  it("should NOT parse contractions with single quotes like don't or isn't", () => {
    const node = renderRichText("It isn't a problem to use 'ROOTED IN' here.");
    const html = renderToStaticMarkup(<>{node}</>);
    expect(html).toBe('It isn&#x27;t a problem to use <code class="font-mono text-[0.9em] bg-accent/8 border border-accent/18 text-accent-strong rounded-[4px] px-[5px] py-[1px] font-semibold [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">ROOTED IN</code> here.');
  });
});
