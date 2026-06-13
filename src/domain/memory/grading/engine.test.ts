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

  it("grades correct objective answers (meaning_choice) including acceptable answers without calling LLM", async () => {
    const exercise = {
      type: "meaning_choice",
      correctAnswer: "Ổn rồi",
      acceptableAnswers: ["Được rồi"],
    } as any;
    
    const result = await grader.grade({
      userId: "user-1",
      exercise,
      answer: "Ổn rồi",
    });
    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(100);
    expect(llm.calls.length).toBe(0);

    const resultAcceptable = await grader.grade({
      userId: "user-1",
      exercise,
      answer: "Được rồi",
    });
    expect(resultAcceptable.isCorrect).toBe(true);
    expect(resultAcceptable.score).toBe(100);
    expect(llm.calls.length).toBe(0);
  });

  it("grades incorrect objective answers, returns structured error data, and does not call LLM", async () => {
    const exercise = {
      type: "meaning_choice",
      correctAnswer: "Ổn rồi",
      promptVi: "Hỏi",
      promptEn: "Prompt",
    } as any;
    
    const result = await grader.grade({
      userId: "user-1",
      exercise,
      answer: "Nhìn đẹp",
    });
    
    expect(result.isCorrect).toBe(false);
    expect(result.score).toBe(0);
    expect(result.error?.shouldSave).toBe(true);
    expect(result.error?.confidence).toBe(100);
    expect(result.error?.errorType).toBe("phrase_misunderstanding");
    expect(result.error?.targetItem).toBe("Ổn rồi");
    expect(llm.calls.length).toBe(0);
  });

  it("calls LLM and returns AI result for focus_question subjective exercise", async () => {
    const exercise = {
      type: "focus_question",
      promptVi: "Câu hỏi tiêu điểm",
      promptEn: "Why?",
      rubricVi: "Hiểu đúng bản chất ngữ pháp",
    } as any;

    const result = await grader.grade({
      userId: "user-1",
      lessonId: "lesson-1",
      exercise,
      answer: "Vì nó đúng",
    });

    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(90);
    expect(llm.calls.length).toBe(1);
    expect(llm.calls[0].purpose).toBe("grading");
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
