import { describe, expect, it, beforeEach } from "vitest";
import { DefaultGradingEngine } from "./engine";
import type { LLMProvider } from "@/domain/ai";

class MockLLMProvider implements LLMProvider {
  calls: any[] = [];
  result: any = {
    score: 90,
    isCorrect: true,
    feedbackVi: "AI: Tốt lắm!",
  };
  error: Error | null = null;

  async generateJson<T>(options: any): Promise<T> {
    this.calls.push(options);
    if (this.error) throw this.error;
    return this.result as T;
  }
}

describe("DefaultGradingEngine Domain Orchestrator", () => {
  let llm: MockLLMProvider;
  let grader: DefaultGradingEngine;

  beforeEach(() => {
    llm = new MockLLMProvider();
    grader = new DefaultGradingEngine(llm);
  });

  it("bypasses LLM call and returns local rule result for objective exercise (meaning_choice)", async () => {
    const exercise = {
      type: "meaning_choice",
      correctAnswer: "Ổn rồi",
      acceptableAnswers: [],
    } as any;

    const result = await grader.grade({
      userId: "user-1",
      exercise,
      answer: "Ổn rồi",
    });

    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(100);
    expect(llm.calls.length).toBe(0); // No AI call made
  });

  it("calls LLM and returns AI result for subjective exercise (natural_translation)", async () => {
    const exercise = {
      type: "natural_translation",
      promptVi: "Dịch sang tiếng Việt tự nhiên",
      promptEn: "Could you take a look when you get a chance?",
      rubricVi: "Hiểu đúng nghĩa polite work request",
    } as any;

    const result = await grader.grade({
      userId: "user-1",
      lessonId: "lesson-1",
      exercise,
      answer: "Khi nào rảnh xem giùm nha",
    });

    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(90);
    expect(result.feedbackVi).toBe("AI: Tốt lắm!");
    expect(llm.calls.length).toBe(1);
    expect(llm.calls[0].purpose).toBe("grading");
    expect(llm.calls[0].userId).toBe("user-1");
    expect(llm.calls[0].lessonId).toBe("lesson-1");
  });

  it("gracefully catches AI errors and returns fallback failed grade", async () => {
    const exercise = {
      type: "natural_translation",
      promptVi: "Dịch",
      correctAnswer: "Xem giúp",
    } as any;

    llm.error = new Error("AI provider quota exceeded");

    const result = await grader.grade({
      userId: "user-1",
      exercise,
      answer: "xem qua",
    });

    expect(result.isCorrect).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedbackVi).toContain("Chưa thể chấm câu trả lời này");
    expect(result.error?.shouldSave).toBe(false);
  });
});
