import { describe, expect, it } from "vitest";
import { SectionCard } from "./section-card";
import { renderToStaticMarkup } from "react-dom/server";

describe("SectionCard", () => {
  it("renders with correct base class names and structure", () => {
    const html = renderToStaticMarkup(
      <SectionCard>
        <SectionCard.Header title="Test Title" />
        <SectionCard.Body>Test Body</SectionCard.Body>
      </SectionCard>
    );
    expect(html).toContain("bg-surface");
    expect(html).toContain("border-border");
    expect(html).toContain("rounded-lg");
    expect(html).toContain("shadow-md");
    expect(html).toContain("p-5");
    expect(html).toContain("sm:p-8");
  });

  it("renders header with icon and title", () => {
    const html = renderToStaticMarkup(
      <SectionCard>
        <SectionCard.Header
          title="Section Header"
          description="Section Description"
          icon={<span id="test-icon" />}
        />
      </SectionCard>
    );
    expect(html).toContain("Section Header");
    expect(html).toContain("Section Description");
    expect(html).toContain('id="test-icon"');
    expect(html).toContain("text-xl");
    expect(html).toContain("font-bold");
  });
});
