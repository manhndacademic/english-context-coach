import { describe, expect, it } from "vitest";
import { Badge } from "./badge";
import { renderToStaticMarkup } from "react-dom/server";

describe("Badge", () => {
  it("renders with default variants", () => {
    const html = renderToStaticMarkup(<Badge>Muted Label</Badge>);
    expect(html).toContain("bg-surface-strong");
    expect(html).toContain("text-muted");
    expect(html).toContain("px-2.5");
    expect(html).toContain("text-xs");
  });

  it("renders accent variant", () => {
    const html = renderToStaticMarkup(
      <Badge variant="accent">Accent Label</Badge>
    );
    expect(html).toContain("bg-accent");
    expect(html).toContain("text-white");
  });

  it("renders success variant", () => {
    const html = renderToStaticMarkup(<Badge variant="success">Success</Badge>);
    expect(html).toContain("bg-success");
    expect(html).toContain("text-white");
  });

  it("renders md size", () => {
    const html = renderToStaticMarkup(<Badge size="md">Large Label</Badge>);
    expect(html).toContain("px-3");
    expect(html).toContain("text-sm");
  });
});
