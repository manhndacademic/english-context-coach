import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ExerciseCard } from "./exercise-card";
import { renderToStaticMarkup } from "react-dom/server";
import type { Exercise, KeyPhrase } from "@/domain/lesson";
import type { Attempt } from "@/domain/memory";

// Mock the server action to avoid loading next-auth/guards/next/server during unit tests
vi.mock("@/app/actions/attempts", () => ({
  submitAttemptAction: () => {},
}));

// Mock the react-dom useFormStatus hook
import * as reactDom from "react-dom";
vi.mock("react-dom", async (importOriginal) => {
  const original = await importOriginal<typeof reactDom>();
  return {
    ...original,
    useFormStatus: () => ({ pending: false }),
  };
});

const mockKeyPhrase: KeyPhrase = {
  id: "kp-1",
  phrase: "excel at",
  conceptKey: "excel_at",
  conceptPhrase: "excel at",
  conceptMeaningVi: "làm tốt một cách vượt trội",
  meaningVi: "làm tốt một cách vượt trội",
  meaningInContextVi: "xuất sắc trong công việc",
  exampleEn: "She excels at solving problems.",
  exampleVi: "Cô ấy xuất sắc trong giải quyết vấn đề.",
  category: "general_phrase",
  difficulty: "B2",
} as any;

describe("ExerciseCard Conditional Key Phrase Visibility", () => {
  it("hides the target phrase link for an unsolved cloze_phrase exercise", () => {
    const exercise: Exercise = {
      id: "ex-1",
      lessonId: "les-1",
      type: "cloze_phrase",
      phrase: "excel at",
      promptVi: "Điền vào chỗ trống",
      promptEn: "Gemma models can be tuned to ______ specific tasks.",
      correctAnswer: "excel at",
      acceptableAnswers: ["excel at"],
    } as any;

    const attempts: Attempt[] = [];

    const html = renderToStaticMarkup(
      <ExerciseCard
        exercise={exercise}
        attempts={attempts}
        keyPhrase={mockKeyPhrase}
      />
    );

    // Should NOT contain the target phrase text or link pointing to it
    expect(html).not.toContain("Luyện tập cụm từ:");
    expect(html).not.toContain("excel at");
  });

  it("shows the target phrase link for a solved cloze_phrase exercise", () => {
    const exercise: Exercise = {
      id: "ex-1",
      lessonId: "les-1",
      type: "cloze_phrase",
      phrase: "excel at",
      promptVi: "Điền vào chỗ trống",
      promptEn: "Gemma models can be tuned to ______ specific tasks.",
      correctAnswer: "excel at",
      acceptableAnswers: ["excel at"],
    } as any;

    // Solved attempt
    const attempts: Attempt[] = [
      {
        id: "att-1",
        userId: "user-1",
        exerciseId: "ex-1",
        lessonId: "les-1",
        answer: "excel at",
        score: 100,
        isCorrect: true,
        feedbackVi: "Chính xác!",
        createdAt: new Date("2026-06-13T00:00:00.000Z"),
      } as any,
    ];

    const html = renderToStaticMarkup(
      <ExerciseCard
        exercise={exercise}
        attempts={attempts}
        keyPhrase={mockKeyPhrase}
      />
    );

    // Should contain the target phrase text and link
    expect(html).toContain("Luyện tập cụm từ:");
    expect(html).toContain("excel at");
    expect(html).toContain("href=\"#keyphrase-kp-1\"");
  });

  it("shows the target phrase link for an unsolved phrase_production exercise", () => {
    const exercise: Exercise = {
      id: "ex-2",
      lessonId: "les-1",
      type: "phrase_production",
      phrase: "excel at",
      promptVi: "Hãy đặt câu sử dụng cụm từ 'excel at'",
      correctAnswer: "She excels at it.",
      acceptableAnswers: ["She excels at it."],
      rubricVi: "Phải dùng cụm từ đúng.",
    } as any;

    const attempts: Attempt[] = [];

    const html = renderToStaticMarkup(
      <ExerciseCard
        exercise={exercise}
        attempts={attempts}
        keyPhrase={mockKeyPhrase}
      />
    );

    // Should contain the target phrase link even when unsolved
    expect(html).toContain("Luyện tập cụm từ:");
    expect(html).toContain("excel at");
  });
});
