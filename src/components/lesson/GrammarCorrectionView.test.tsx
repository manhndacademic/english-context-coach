import { describe, expect, it } from "vitest";
import { GrammarCorrectionView } from "./GrammarCorrectionView";
import { renderToStaticMarkup } from "react-dom/server";

const mockLesson = {
  summaryVi: "Tóm tắt bài học",
  naturalTranslationVi: "Dịch tự nhiên",
  contextExplanationVi: "Giải thích ngữ cảnh",
};

const mockLessonFocuses = [
  {
    id: "lf-1",
    title: "Trọng tâm 1",
    explanationVi: "Giải thích trọng tâm 1",
    category: "structure",
    difficulty: "B1",
  },
];

describe("GrammarCorrectionView", () => {
  it("renders comparison panel side-by-side when differences exist", () => {
    const breakdowns = [
      {
        id: "sb-1",
        sentence: "I goes to office yesterday.",
        correctedSentenceEn: "I went to the office yesterday.",
        naturalMeaningVi: "Tôi đã đến văn phòng ngày hôm qua.",
        structureNotesVi: "Dùng quá khứ đơn 'went' thay vì hiện tại 'goes'.",
        toneOrContextVi: null,
      },
    ];

    const html = renderToStaticMarkup(
      <GrammarCorrectionView
        lesson={mockLesson}
        sentenceBreakdowns={breakdowns}
        lessonFocuses={mockLessonFocuses}
      />
    );

    expect(html).toContain("So sánh văn bản");
    expect(html).toContain("Bản gốc của bạn");
    expect(html).toContain("Đề xuất chỉnh sửa");
    expect(html).toContain("goes");
    expect(html).toContain("went");
  });

  it("renders a success badge when no differences exist", () => {
    const breakdowns = [
      {
        id: "sb-1",
        sentence: "I went to the office yesterday.",
        correctedSentenceEn: "I went to the office yesterday.",
        naturalMeaningVi: "Tôi đã đến văn phòng ngày hôm qua.",
        structureNotesVi: "Câu viết đúng ngữ pháp.",
        toneOrContextVi: null,
      },
    ];

    const html = renderToStaticMarkup(
      <GrammarCorrectionView
        lesson={mockLesson}
        sentenceBreakdowns={breakdowns}
        lessonFocuses={mockLessonFocuses}
      />
    );

    expect(html).toContain("So sánh văn bản");
    expect(html).toContain("Không phát hiện lỗi");
  });
});
