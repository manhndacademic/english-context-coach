import { describe, expect, it } from "vitest";
import { GradingFeedback } from "./grading-feedback";
import { renderToStaticMarkup } from "react-dom/server";

describe("GradingFeedback Component", () => {
  it("renders basic feedback for a correct answer in exercises", () => {
    const html = renderToStaticMarkup(
      <GradingFeedback
        type="exercise"
        isCorrect={true}
        feedbackVi="Chính xác! Câu trả lời rất tốt."
        answer="I excel at writing code."
        solved={true}
        isSubjectiveType={true}
        naturalAnswer="I excel at coding."
      />
    );

    expect(html).toContain("Chính xác");
    expect(html).toContain("Chính xác! Câu trả lời rất tốt.");
    expect(html).toContain("Gợi ý");
    expect(html).toContain("I excel at coding.");
  });

  it("renders in-depth structured feedback when incorrect", () => {
    const feedbackDetails = {
      whatWasWrong: "Dùng từ sai giới từ.",
      whyItWasWrong: "excel đi với at chứ không đi với in.",
      correctUnderstanding: "excel at doing something.",
      nextPracticeItem: "Hãy thử viết câu với excel at.",
      detailedExplanation: "Chi tiết ngữ pháp của từ excel...",
      mistakeType: "Grammar Mistake",
    };

    const html = renderToStaticMarkup(
      <GradingFeedback
        type="exercise"
        isCorrect={false}
        feedbackVi="Bạn dùng sai giới từ."
        answer="I excel in coding."
        feedbackDetails={feedbackDetails}
      />
    );

    expect(html).toContain("Gợi ý cải thiện");
    expect(html).toContain("Grammar Mistake");
    expect(html).toContain("Lỗi sai phát hiện:");
    expect(html).toContain("Dùng từ sai giới từ.");
    expect(html).toContain("Lý do nhầm lẫn:");
    expect(html).toContain("excel đi với at chứ không đi với in.");
    expect(html).toContain("Hiểu đúng tự nhiên trong ngữ cảnh:");
    expect(html).toContain("excel at doing something.");
    expect(html).toContain("Luyện tập nhanh:");
    expect(html).toContain("Hãy thử viết câu với excel at.");
    expect(html).toContain("Giải thích thêm (Explain more)");
    expect(html).toContain("Chi tiết ngữ pháp của từ excel...");
  });

  it("displays literal trap text when provided and incorrect", () => {
    const html = renderToStaticMarkup(
      <GradingFeedback
        type="exercise"
        isCorrect={false}
        feedbackVi="Sai dịch."
        answer="He is a black horse."
        literalTranslationTrap="con ngựa màu đen"
      />
    );

    expect(html).toContain("Bẫy dịch từng từ (Literal Trap)");
    expect(html).toContain("Tránh dịch:");
    expect(html).toContain("con ngựa màu đen");
  });

  it("displays repeated mistake warnings when isRepeated is true", () => {
    const html = renderToStaticMarkup(
      <GradingFeedback
        type="exercise"
        isCorrect={false}
        feedbackVi="Sai rồi."
        answer="He is wrong."
        isRepeated={true}
      />
    );

    expect(html).toContain("Bạn đã từng gặp lỗi này trước đây.");
  });

  it("renders review specific layout correctly", () => {
    const html = renderToStaticMarkup(
      <GradingFeedback
        type="review"
        isCorrect={true}
        feedbackVi="Tốt lắm."
        answer="Correct answer"
        naturalAnswer="Natural correct answer"
        nextReviewDate="2026-06-20"
        masteryState="learning"
      />
    );

    expect(html).toContain("Đạt yêu cầu");
    expect(html).toContain("Hoàn thành xuất sắc");
    expect(html).toContain("Đáp án tự nhiên");
    expect(html).toContain("Natural correct answer");
    expect(html).toContain("Lần ôn tiếp theo: 2026-06-20.");
  });
});
