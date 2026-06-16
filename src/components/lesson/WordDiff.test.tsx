import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WordDiff } from "./WordDiff";

describe("WordDiff", () => {
  it("renders equal text as plain text when no diff", () => {
    const html = renderToStaticMarkup(
      <WordDiff original="tôi thích cà phê" corrected="tôi thích cà phê" />
    );
    expect(html).toContain("tôi thích cà phê");
  });

  it("shows ✅ Không có lỗi badge when strings are identical", () => {
    const html = renderToStaticMarkup(
      <WordDiff original="tự nhiên hơn" corrected="tự nhiên hơn" />
    );
    expect(html).toContain("Không có lỗi");
  });

  it("shows ✅ Không có lỗi badge when corrected is null", () => {
    const html = renderToStaticMarkup(
      <WordDiff original="tự nhiên hơn" corrected={null} />
    );
    expect(html).toContain("Không có lỗi");
  });

  it("marks deleted words with data-diff-type=delete", () => {
    const html = renderToStaticMarkup(
      <WordDiff original="gặp rắc rối" corrected="dính vào rắc rối" />
    );
    expect(html).toContain('data-diff-type="delete"');
    expect(html).toContain("gặp");
  });

  it("marks inserted words with data-diff-type=insert", () => {
    const html = renderToStaticMarkup(
      <WordDiff original="gặp rắc rối" corrected="dính vào rắc rối" />
    );
    expect(html).toContain('data-diff-type="insert"');
    expect(html).toContain("dính");
  });

  it("renders equal words with data-diff-type=equal", () => {
    const html = renderToStaticMarkup(
      <WordDiff original="gặp rắc rối" corrected="dính vào rắc rối" />
    );
    expect(html).toContain('data-diff-type="equal"');
    expect(html).toContain("rắc");
  });

  it("renders both delete and insert spans for a substitution", () => {
    const html = renderToStaticMarkup(
      <WordDiff original="rất thú vị" corrected="thú vị thật sự" />
    );
    expect(html).toContain('data-diff-type="delete"');
    expect(html).toContain('data-diff-type="insert"');
  });

  it("accepts optional className and applies it to the container", () => {
    const html = renderToStaticMarkup(
      <WordDiff original="a" corrected="b" className="my-custom-class" />
    );
    expect(html).toContain("my-custom-class");
  });
});
