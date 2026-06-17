import { describe, expect, it } from "vitest";
import { StatCard } from "./stat-card";
import { renderToStaticMarkup } from "react-dom/server";

describe("StatCard", () => {
  it("renders label and value with default styles", () => {
    const html = renderToStaticMarkup(
      <StatCard label="Completed Lessons" value={42} />
    );
    expect(html).toContain("Completed Lessons");
    expect(html).toContain("42");
    expect(html).toContain("hover-lift");
    expect(html).toContain("text-text");
  });

  it("applies accent color variant to the value", () => {
    const html = renderToStaticMarkup(
      <StatCard label="Accuracy" value="85%" valueVariant="accent" />
    );
    expect(html).toContain("text-accent");
  });

  it("applies warning color variant to the value", () => {
    const html = renderToStaticMarkup(
      <StatCard label="Reviews Due" value={5} valueVariant="warning" />
    );
    expect(html).toContain("text-warning");
  });
});
