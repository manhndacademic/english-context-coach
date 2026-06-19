import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AnswerSuggestions } from "./AnswerSuggestions";

describe("AnswerSuggestions Component", () => {
  it("renders natural answer for review mode when correct", () => {
    const html = renderToStaticMarkup(
      <AnswerSuggestions
        isReview={true}
        isCorrect={true}
        naturalAnswer="This is a natural response."
        answer="This is a natural response."
      />
    );
    expect(html).toContain("Đáp án tự nhiên");
    expect(html).toContain("This is a natural response.");
  });

  it("renders natural answer comparison with WordDiff for review mode when incorrect", () => {
    const html = renderToStaticMarkup(
      <AnswerSuggestions
        isReview={true}
        isCorrect={false}
        naturalAnswer="This is correct."
        answer="This is wrong."
        isSubjectiveType={true}
      />
    );
    expect(html).toContain("Đáp án tự nhiên");
    // WordDiff output checks
    expect(html).toContain("ins");
    expect(html).toContain("del");
  });

  it("renders natural expression for exercise when solved", () => {
    const html = renderToStaticMarkup(
      <AnswerSuggestions
        isReview={false}
        isCorrect={true}
        naturalAnswer="Exercise natural answer"
        solved={true}
        isSubjectiveType={true}
        answer="Some answer"
      />
    );
    expect(html).toContain("Cách diễn đạt tự nhiên");
    expect(html).toContain("Exercise natural answer");
  });

  it("renders suggestion for exercise when not solved and showSuggestion is true", () => {
    const html = renderToStaticMarkup(
      <AnswerSuggestions
        isReview={false}
        isCorrect={false}
        naturalAnswer="Suggested answer"
        solved={false}
        showSuggestion={true}
        answer="Attempted answer"
      />
    );
    expect(html).toContain("Gợi ý đáp án");
    expect(html).toContain("Suggested answer");
  });

  it("renders literal translation trap when provided and incorrect", () => {
    const html = renderToStaticMarkup(
      <AnswerSuggestions
        isReview={false}
        isCorrect={false}
        literalTranslationTrap="con ngựa đen"
        answer="black horse"
      />
    );
    expect(html).toContain("Bẫy dịch từng từ (Literal Trap)");
    expect(html).toContain("con ngựa đen");
  });
});
