import { describe, expect, it } from "vitest";
import { ConfirmDialog } from "./dialog";
import { renderToStaticMarkup } from "react-dom/server";

describe("ConfirmDialog", () => {
  it("renders with m-auto class for centering override", () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Test Title"
        description="Test Description"
      />
    );

    // The <dialog> tag should contain 'm-auto' class to override Tailwind's margin: 0 preflight
    expect(html).toContain("m-auto");
  });
});
