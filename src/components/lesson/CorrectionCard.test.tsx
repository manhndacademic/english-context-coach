import { describe, expect, it, vi } from "vitest";
import { CorrectionCard } from "./CorrectionCard";
import { renderToStaticMarkup } from "react-dom/server";

// Mock the server action to avoid runtime reference errors
vi.mock("@/app/actions/source-texts", () => ({
  updateCorrectionPhraseAction: vi.fn(),
}));

describe("CorrectionCard", () => {
  const mockItem = {
    id: "corr-1",
    category: "grammar",
    errorType: "vietlish_grammar",
    draftPhrase: "I am agree with you",
    correctedPhrase: "I agree with you",
    explanationVi:
      "Trong tiếng Anh, 'agree' là động từ, không dùng với 'am' ở thể chủ động.",
    literalTrapVi:
      "Người Việt hay dịch từ 'tôi đồng ý' thành 'I am agree' vì nghĩ đồng ý là tính từ.",
    culturalNoteVi:
      "Đây là lỗi ngữ pháp phổ biến của người Việt học tiếng Anh.",
    exampleEn: "I agree with your proposal.",
    exampleVi: "Tôi đồng ý với đề xuất của bạn.",
  };

  it("renders correct information for active correction", () => {
    const onToggleReject = vi.fn();
    const html = renderToStaticMarkup(
      <CorrectionCard
        item={mockItem}
        lessonId="lesson-1"
        isRejected={false}
        onToggleReject={onToggleReject}
      />
    );

    // Categories and error types
    expect(html).toContain("grammar");
    expect(html).toContain("vietlish grammar");
    // Phrases
    expect(html).toContain("I am agree with you");
    expect(html).toContain("I agree with you");
    // Explanations
    expect(html).toContain("Trong tiếng Anh, &#x27;agree&#x27; là động từ");
    expect(html).toContain("Bẫy dịch từng từ");
    expect(html).toContain("Lưu ý bối cảnh &amp; văn hóa");
    expect(html).toContain("I agree with your proposal.");
  });

  it("renders correct state when rejected", () => {
    const onToggleReject = vi.fn();
    const html = renderToStaticMarkup(
      <CorrectionCard
        item={mockItem}
        lessonId="lesson-1"
        isRejected={true}
        onToggleReject={onToggleReject}
      />
    );

    expect(html).toContain("opacity-60 bg-surface-strong/30 border-dashed");
    expect(html).toContain("💡 Tham khảo");
    expect(html).toContain("↩️ Giữ bản gốc");
  });
});
