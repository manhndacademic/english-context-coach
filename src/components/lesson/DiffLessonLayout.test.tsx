import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DiffLessonLayout } from "./DiffLessonLayout";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

// Mock server actions
vi.mock("@/app/actions/source-texts", () => ({
  generateExercisesAction: vi.fn(),
}));

// Mock AppHeader
vi.mock("@/components/app-header", () => ({
  AppHeader: () => <div data-testid="app-header">Header</div>,
}));

// Mock LessonHeader
vi.mock("./LessonHeader", () => ({
  LessonHeader: () => <div data-testid="lesson-header">Lesson Header</div>,
}));

// Mock ExercisePanel
vi.mock("./ExercisePanel", () => ({
  ExercisePanel: () => <div data-testid="exercise-panel">Exercise Panel</div>,
}));

// Mock RepeatedMistakeBanner
vi.mock("./RepeatedMistakeBanner", () => ({
  RepeatedMistakeBanner: () => (
    <div data-testid="repeated-mistake-banner">Repeated Mistakes</div>
  ),
}));

describe("DiffLessonLayout", () => {
  const mockUser = { email: "user@example.com", role: "user" };

  const baseLessonData = {
    lesson: {
      id: "lesson-1",
      sourceTextId: "st-1",
      version: 1,
      analysisStatus: "succeeded",
      exerciseStatus: "idle",
      title: "Write Email Practice",
      textType: "email",
      detectedLevel: "B2",
      updatedAt: new Date(),
      inputMode: "write",
      summaryVi: "Tóm tắt bài học",
      naturalTranslationVi: "Dịch tự nhiên",
      contextExplanationVi:
        "Văn bản của bạn nghe hơi trực tiếp cho email trang trọng.",
    },
    sourceText: {
      content: "I am writing to check the status.",
    },
    draftText: {
      content: "I write to check status.",
    },
    correctionItems: [
      {
        id: "corr-1",
        draftPhrase: "check status",
        correctedPhrase: "check the status",
        explanationVi: "Nên dùng status trong email trang trọng.",
        literalTrapVi: "Bẫy dịch từng chữ ở đây",
        culturalNoteVi:
          "Trong email trang trọng, check the status lịch sự hơn.",
        exampleEn: "Could you check the status?",
        exampleVi: "Bạn có thể kiểm tra trạng thái không?",
        category: "general_phrase",
        errorType: "collocation_error",
      },
    ],
    exercises: [],
    exercisePractices: [],
    mistakePatterns: [],
    progress: {},
  };

  it("renders the overall Tone Analysis banner when contextExplanationVi is available", () => {
    const html = renderToStaticMarkup(
      <DiffLessonLayout
        user={mockUser}
        lessonData={baseLessonData}
        now={Date.now()}
      />
    );

    expect(html).toContain("Đánh giá giọng điệu (Tone Analysis)");
    expect(html).toContain(
      "Văn bản của bạn nghe hơi trực tiếp cho email trang trọng."
    );
  });

  it("renders culturalNoteVi callout inside the correction card when present", () => {
    const html = renderToStaticMarkup(
      <DiffLessonLayout
        user={mockUser}
        lessonData={baseLessonData}
        now={Date.now()}
      />
    );

    expect(html).toContain("Lưu ý bối cảnh &amp; văn hóa:");
    expect(html).toContain(
      "Trong email trang trọng, check the status lịch sự hơn."
    );
  });

  it("renders Accept/Reject toggle button on correction card with default state 'Đồng ý sửa'", () => {
    const html = renderToStaticMarkup(
      <DiffLessonLayout
        user={mockUser}
        lessonData={baseLessonData}
        now={Date.now()}
      />
    );

    expect(html).toContain("Đồng ý sửa");
  });
});
