import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { renderToStaticMarkup } from "react-dom/server";

describe("Button", () => {
  it("renders standard button element by default", () => {
    const html = renderToStaticMarkup(<Button>Test Button</Button>);
    expect(html).toContain("<button");
    expect(html).toContain("bg-accent");
    expect(html).toContain("hover-shadow-accent");
  });

  it("renders as child element when asChild is true", () => {
    const html = renderToStaticMarkup(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    expect(html).not.toContain("<button");
    expect(html).toContain('<a href="/test"');
    expect(html).toContain("bg-accent");
    expect(html).toContain("hover-shadow-accent");
  });
});
