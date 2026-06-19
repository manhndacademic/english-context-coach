import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { IncorrectDetails } from "./IncorrectDetails";

describe("IncorrectDetails Component", () => {
  it("renders correctly with full feedback details", () => {
    const feedbackDetails = {
      whatWasWrong: "Lỗi dùng sai giới từ.",
      whyItWasWrong: "Giới từ sai.",
      correctUnderstanding: "Đúng là...",
      nextPracticeItem: "Luyện tập:...",
      detailedExplanation: "Giải thích chi tiết...",
    };

    const html = renderToStaticMarkup(
      <IncorrectDetails
        feedbackDetails={feedbackDetails}
        answer="I did it."
        naturalAnswer="I did it naturally."
        isSubjectiveType={true}
      />
    );

    expect(html).toContain("Lỗi sai phát hiện:");
    expect(html).toContain("Lỗi dùng sai giới từ.");
    expect(html).toContain("Lý do nhầm lẫn:");
    expect(html).toContain("Giới từ sai.");
    expect(html).toContain("Hiểu đúng tự nhiên trong ngữ cảnh:");
    expect(html).toContain("Đúng là...");
    expect(html).toContain("Luyện tập nhanh:");
    expect(html).toContain("Luyện tập:...");
    expect(html).toContain("Giải thích thêm (Explain more)");
    expect(html).toContain("Giải thích chi tiết...");
    expect(html).toContain("So sánh lỗi:");
  });

  it("omits empty feedback details cleanly", () => {
    const feedbackDetails = {
      whatWasWrong: "Lỗi dùng sai giới từ.",
    };

    const html = renderToStaticMarkup(
      <IncorrectDetails feedbackDetails={feedbackDetails} answer="I did it." />
    );

    expect(html).toContain("Lỗi sai phát hiện:");
    expect(html).toContain("Lỗi dùng sai giới từ.");
    expect(html).not.toContain("Lý do nhầm lẫn:");
    expect(html).not.toContain("Hiểu đúng tự nhiên trong ngữ cảnh:");
    expect(html).not.toContain("Luyện tập nhanh:");
    expect(html).not.toContain("Giải thích thêm (Explain more)");
  });
});
