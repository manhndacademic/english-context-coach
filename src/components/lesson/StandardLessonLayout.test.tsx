import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StandardLessonLayout } from "./StandardLessonLayout";

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

// Mock ReadableSourceText
vi.mock("@/components/readable-source-text", () => ({
  ReadableSourceText: () => (
    <div data-testid="readable-source-text">Source Text</div>
  ),
}));

// Mock SourceMeaningPanel
vi.mock("./SourceMeaningPanel", () => ({
  SourceMeaningPanel: () => (
    <div data-testid="source-meaning-panel">Meaning Panel</div>
  ),
}));

// Mock SentenceBreakdownPanel
vi.mock("./SentenceBreakdownPanel", () => ({
  SentenceBreakdownPanel: () => (
    <div data-testid="sentence-breakdown-panel">Sentence Breakdown</div>
  ),
}));

// Mock KeyPhraseList
vi.mock("@/components/key-phrase-list", () => ({
  KeyPhraseList: () => <div data-testid="key-phrase-list">Key Phrases</div>,
}));

describe("StandardLessonLayout", () => {
  const mockUser = { email: "user@example.com", role: "user" };

  const baseLessonData = {
    lesson: {
      id: "lesson-1",
      sourceTextId: "st-1",
      version: 1,
      analysisStatus: "succeeded",
      exerciseStatus: "succeeded",
      title: "Reading Practice",
      textType: "general",
      detectedLevel: "B1",
      updatedAt: new Date(),
      inputMode: "read",
      summaryVi: "Tóm tắt",
      naturalTranslationVi: null,
      contextExplanationVi: null,
    },
    sourceText: {
      content: "This is a simple reading text.",
    },
    keyPhrases: [],
    lessonFocuses: [],
    exercises: [{ id: "ex-1" }],
    exercisePractices: [],
    sentenceBreakdowns: [],
    mistakePatterns: [],
    progress: {},
  };

  it("initializes as locked when exercises succeeded but no attempts exist, showing custom overlay button", () => {
    const lockedLessonData = {
      ...baseLessonData,
      exercisePractices: [],
    };

    const html = renderToStaticMarkup(
      <StandardLessonLayout
        user={mockUser}
        lessonData={lockedLessonData}
        now={Date.now()}
      />
    );

    // Old left-column bottom button should not exist
    expect(html).not.toContain("Đã hiểu ngữ cảnh, bắt đầu thực hành");
    // New lock overlay details should exist
    expect(html).toContain("Bài tập thực hành đang khóa");
    expect(html).toContain("Nhấn để bắt đầu luyện tập");
    expect(html).toContain("animate-pulse-glow");
  });

  it("auto-unlocks (starts in practice phase) when exercises succeeded and user has previous attempts", () => {
    const unlockedLessonData = {
      ...baseLessonData,
      exercisePractices: [
        {
          id: "p-1",
          attempts: [{ id: "attempt-1" }],
        },
      ],
    };

    const html = renderToStaticMarkup(
      <StandardLessonLayout
        user={mockUser}
        lessonData={unlockedLessonData}
        now={Date.now()}
      />
    );

    expect(html).not.toContain("Bài tập thực hành đang khóa");
    expect(html).not.toContain("Nhấn để bắt đầu luyện tập");
  });
});
