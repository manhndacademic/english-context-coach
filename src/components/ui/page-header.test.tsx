import { describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";
import { renderToStaticMarkup } from "react-dom/server";

describe("PageHeader", () => {
  it("renders title and description", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Learning Progress" description="Track your errors" />
    );
    expect(html).toContain("Learning Progress");
    expect(html).toContain("Track your errors");
    expect(html).toContain("font-serif");
    expect(html).toContain("text-2xl");
  });

  it("renders back link if backHref is provided", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Progress" backHref="/dashboard" backLabel="Go back" />
    );
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain("Go back");
  });
});
