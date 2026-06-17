import { describe, expect, it, vi } from "vitest";
import { PageLayout, PageContainer } from "./page-layout";
import { renderToStaticMarkup } from "react-dom/server";

// Mock AppHeader to avoid loading complex next-auth imports in pure unit test
vi.mock("@/components/app-header", () => ({
  AppHeader: ({ email }: any) => <div id="mock-header">Header: {email}</div>,
}));

describe("PageContainer", () => {
  it("renders with canonical max-width and padding", () => {
    const html = renderToStaticMarkup(
      <PageContainer>
        <div>Content</div>
      </PageContainer>
    );
    expect(html).toContain("max-w-[1100px]");
    expect(html).toContain("mx-auto");
    expect(html).toContain("px-4");
  });
});

describe("PageLayout", () => {
  it("renders PageContainer with children inside and mocked header", () => {
    const html = renderToStaticMarkup(
      <PageLayout
        user={{ email: "test@example.com", role: "user", image: null }}
      >
        <div id="test-child">Layout Child</div>
      </PageLayout>
    );
    expect(html).toContain("mock-header");
    expect(html).toContain("Header: test@example.com");
    expect(html).toContain("test-child");
    expect(html).toContain("Layout Child");
    expect(html).toContain("max-w-[1100px]");
  });
});
