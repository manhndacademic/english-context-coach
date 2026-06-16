import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HomePage from "./page";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => null),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`Unexpected redirect to ${href}`);
  }),
}));

describe("HomePage landing page", () => {
  it("positions the product around understanding workplace English without literal translation", async () => {
    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain(
      "Hiểu đúng tiếng Anh trong công việc, không dịch từng chữ."
    );
    expect(html).toContain("Dán email, GitHub issue, tài liệu API");
    expect(html).toContain("Dùng thử miễn phí");
  });

  it("shows a product demo that turns pasted work English into a contextual lesson", async () => {
    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain(
      "Dán một đoạn tiếng Anh thật. Nhận một bài học cá nhân hóa."
    );
    expect(html).toContain(
      "We need to push this back because the API change is not backward compatible."
    );
    expect(html).toContain(
      "Chúng ta cần dời việc này lại vì thay đổi API không tương thích ngược."
    );
    expect(html).toContain(
      "push this back không phải là &quot;đẩy cái này ra sau&quot;"
    );
    expect(html).toContain(
      "Can we push the release back to next Monday?"
    );
  });

  it("renders all use-case samples for mobile-friendly vertical scanning", async () => {
    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain(
      "This endpoint is deprecated and will be removed in a future release."
    );
    expect(html).toContain(
      "Could you take a look at the proposal when you get a chance?"
    );
    expect(html).toContain(
      "The test coverage was improved, albeit at the cost of execution speed."
    );
  });

  it("shows Mistake Memory progress as labeled demo metrics", async () => {
    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("App học từ lỗi sai của bạn.");
    expect(html).toContain("Ví dụ tiến độ");
    expect(html).toContain("Lỗi dịch từng chữ giảm 32%");
    expect(html).toContain("18 mẫu lỗi đã nắm vững");
    expect(html).toContain("7 ngày ôn tập liên tiếp");
  });

  it("compares ChatGPT with English Context Coach using mobile-readable rows", async () => {
    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain(
      "ChatGPT giúp bạn hiểu một lần. English Context Coach giúp bạn không sai lại lần sau."
    );
    expect(html).toContain("Nhu cầu");
    expect(html).toContain("ChatGPT / Google Translate");
    expect(html).toContain("Tự động tạo bài tập từ đoạn vừa đọc");
    expect(html).toContain("Có Mistake Memory và ôn lại lỗi cũ");
  });

  it("frames grammar correction as secondary and ends with a real-text CTA", async () => {
    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("Khi lỗi là grammar");
    expect(html).toContain("app chỉ rõ điểm cần sửa");
    expect(html).toContain(
      "Thử với một đoạn tiếng Anh bạn đang đọc hôm nay."
    );
    expect(html).toContain(
      "Email, tài liệu API, Slack message, GitHub issue, paper"
    );
  });
});
