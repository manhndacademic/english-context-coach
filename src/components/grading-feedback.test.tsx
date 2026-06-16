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
    expect(html).toContain("Cách diễn đạt tự nhiên");
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
    expect(html).toContain("Tốt lắm.");
    expect(html).toContain("Đáp án tự nhiên");
    expect(html).toContain("Natural correct answer");
    expect(html).toContain("Lần ôn tiếp theo: 2026-06-20");
  });

  it("renders naturalAnswer as a suggestion when showSuggestion is true even if incorrect", () => {
    const html = renderToStaticMarkup(
      <GradingFeedback
        type="exercise"
        isCorrect={false}
        feedbackVi="Sai ngữ pháp."
        answer="Incorrect answer"
        naturalAnswer="This is the correct natural answer."
        showSuggestion={true}
      />
    );

    expect(html).toContain("Gợi ý đáp án");
    expect(html).toContain("This is the correct natural answer.");
  });

  describe("WordDiff integration for subjective exercises/reviews", () => {
    it("renders WordDiff when incorrect, isSubjectiveType=true, and naturalAnswer exists (no feedbackDetails)", () => {
      const html = renderToStaticMarkup(
        <GradingFeedback
          type="exercise"
          isCorrect={false}
          feedbackVi="Sai dịch."
          answer="I like cat"
          naturalAnswer="I like cats"
          isSubjectiveType={true}
          showSuggestion={true}
        />
      );

      // Should render WordDiff spans
      expect(html).toContain('data-diff-type="equal"');
      expect(html).toContain('data-diff-type="delete"');
      expect(html).toContain('data-diff-type="insert"');
      expect(html).toContain("cat");
      expect(html).toContain("cats");
    });

    it("renders WordDiff in a 'So sánh lỗi' block when incorrect, isSubjectiveType=true, and feedbackDetails exists", () => {
      const feedbackDetails = {
        whatWasWrong: "Thiếu danh từ số nhiều.",
        whyItWasWrong: "Cat cần s.",
        correctUnderstanding: "I like cats.",
      };

      const html = renderToStaticMarkup(
        <GradingFeedback
          type="exercise"
          isCorrect={false}
          feedbackVi="Sai dịch."
          answer="I like cat"
          naturalAnswer="I like cats"
          isSubjectiveType={true}
          feedbackDetails={feedbackDetails}
        />
      );

      expect(html).toContain("So sánh lỗi");
      expect(html).toContain('data-diff-type="equal"');
      expect(html).toContain('data-diff-type="delete"');
      expect(html).toContain('data-diff-type="insert"');
    });

    it("renders plain naturalAnswer (no diff spans) when correct, isSubjectiveType=true", () => {
      const html = renderToStaticMarkup(
        <GradingFeedback
          type="exercise"
          isCorrect={true}
          feedbackVi="Chính xác."
          answer="I like cats"
          naturalAnswer="I like cats"
          isSubjectiveType={true}
          solved={true}
        />
      );

      // Should not contain diff marker attributes
      expect(html).not.toContain("data-diff-type=");
      expect(html).toContain("I like cats");
    });

    it("does not render WordDiff spans for objective types (isSubjectiveType=false or undefined)", () => {
      const html = renderToStaticMarkup(
        <GradingFeedback
          type="exercise"
          isCorrect={false}
          feedbackVi="Sai rồi."
          answer="Incorrect answer"
          naturalAnswer="Correct answer"
          isSubjectiveType={false}
          showSuggestion={true}
        />
      );

      expect(html).not.toContain("data-diff-type=");
    });
  });
});
