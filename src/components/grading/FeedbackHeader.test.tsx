import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FeedbackHeader } from "./FeedbackHeader";

describe("FeedbackHeader Component", () => {
  it("renders correctly for correct exercise", () => {
    const html = renderToStaticMarkup(
      <FeedbackHeader isReview={false} isCorrect={true} />
    );
    expect(html).toContain("Chính xác");
    expect(html).not.toContain("Gợi ý cải thiện");
  });

  it("renders correctly for incorrect exercise with mistake type", () => {
    const html = renderToStaticMarkup(
      <FeedbackHeader
        isReview={false}
        isCorrect={false}
        mistakeType="Word Choice"
      />
    );
    expect(html).toContain("Gợi ý cải thiện");
    expect(html).toContain("Word Choice");
  });

  it("renders correctly for correct review", () => {
    const html = renderToStaticMarkup(
      <FeedbackHeader isReview={true} isCorrect={true} />
    );
    expect(html).toContain("Đạt yêu cầu");
    expect(html).toContain("Hoàn thành xuất sắc");
  });

  it("renders correctly for incorrect review with mistake type", () => {
    const html = renderToStaticMarkup(
      <FeedbackHeader isReview={true} isCorrect={false} mistakeType="Grammar" />
    );
    expect(html).toContain("Cần cải thiện");
    expect(html).toContain("Gợi ý cải thiện");
    expect(html).toContain("Grammar");
  });
});
