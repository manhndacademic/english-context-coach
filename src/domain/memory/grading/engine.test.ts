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

  // ─── Objective grading: meaning_choice ───

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
    expect(llm.calls.length).toBe(1);

    const resultAcceptable = await grader.grade({
      userId: "user-1",
      exercise,
      answer: "Được rồi",
    });
    expect(resultAcceptable.isCorrect).toBe(true);
    expect(resultAcceptable.score).toBe(100);
    expect(llm.calls.length).toBe(2);
  });

  it("grades incorrect objective answers by falling back to calling the LLM for detailed feedback", async () => {
    const exercise = {
      type: "meaning_choice",
      correctAnswer: "Ổn rồi",
      promptVi: "Hỏi",
      promptEn: "Prompt",
    } as any;

    llm.result = {
      score: 0,
      isCorrect: false,
      feedbackVi: "AI: Giải thích tại sao chọn 'Nhìn đẹp' là sai...",
      naturalAnswer: "Ổn rồi",
      feedbackDetails: {
        whatWasWrong: "Bạn đã chọn 'Nhìn đẹp'.",
        whyItWasWrong:
          "Cụm từ này không đồng nghĩa với 'Ổn rồi' trong ngữ cảnh.",
        correctUnderstanding: "Nghĩa đúng của cụm từ là 'Ổn rồi'.",
        mistakeType: "Sai đáp án trắc nghiệm",
        detailedExplanation: "Chi tiết...",
      },
      error: {
        shouldSave: true,
        confidence: 100,
        errorType: "phrase_misunderstanding",
        explanationVi: "Lỗi dịch nghĩa.",
        targetItem: "Ổn rồi",
      },
    };

    const result = await grader.grade({
      userId: "user-1",
      exercise,
      answer: "Nhìn đẹp",
    });

    expect(result.isCorrect).toBe(false);
    expect(result.score).toBe(0);
    expect(result.feedbackVi).toBe(
      "AI: Giải thích tại sao chọn 'Nhìn đẹp' là sai..."
    );
    expect(result.feedbackDetails?.mistakeType).toBe("Sai đáp án trắc nghiệm");
    expect(llm.calls.length).toBe(1);
  });

  // ─── Objective grading: cloze_phrase ───

  it("grades correct cloze_phrase without calling LLM", async () => {
    const exercise = {
      type: "cloze_phrase",
      correctAnswer: "propose",
      acceptableAnswers: ["suggest"],
      promptVi: "Điền vào chỗ trống.",
      promptEn: "Can you ____ some solutions for this issue?",
    } as any;

    const result = await grader.grade({
      userId: "user-1",
      exercise,
      answer: "propose",
    });
    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(100);
    expect(llm.calls.length).toBe(1);
  });

  it("grades wrong cloze_phrase and does NOT expose correctAnswer in naturalAnswer but calls LLM", async () => {
    const exercise = {
      type: "cloze_phrase",
      correctAnswer: "propose",
      acceptableAnswers: ["suggest"],
      promptVi: "Điền vào chỗ trống.",
      promptEn: "Can you ____ some solutions for this issue?",
    } as any;

    llm.result = {
      score: 0,
      isCorrect: false,
      feedbackVi: "AI: Sai rồi.",
      feedbackDetails: {
        whatWasWrong: "Bạn đã điền 'review'.",
        whyItWasWrong:
          "'review' nghĩa là xem xét lại, không phù hợp để đề xuất giải pháp.",
        correctUnderstanding:
          "Động từ đề xuất thích hợp là 'propose' hoặc 'suggest'.",
        mistakeType: "Lỗi từ vựng / Sai ngữ cảnh",
        detailedExplanation: "Chi tiết...",
      },
    };

    const result = await grader.grade({
      userId: "user-1",
      exercise,
      answer: "review",
    });
    expect(result.isCorrect).toBe(false);
    expect(result.score).toBe(0);
    // naturalAnswer must NOT leak the correct answer for wrong objective exercises
    expect(result.naturalAnswer).toBeUndefined();
    expect(llm.calls.length).toBe(1);
  });

  it("shows naturalAnswer for correct objective exercises (confirmation)", async () => {
    const exercise = {
      type: "cloze_phrase",
      correctAnswer: "propose",
      acceptableAnswers: ["suggest"],
      promptVi: "Điền vào chỗ trống.",
      promptEn: "Can you ____ some solutions for this issue?",
    } as any;

    const result = await grader.grade({
      userId: "user-1",
      exercise,
      answer: "propose",
    });
    expect(result.isCorrect).toBe(true);
    expect(result.naturalAnswer).toBe("propose");
  });

  // ─── Objective grading: trap_choice ───

  it("grades correct trap_choice without calling LLM", async () => {
    const exercise = {
      type: "trap_choice",
      correctAnswer: "Xem giúp khi rảnh nhé",
      acceptableAnswers: [],
      choices: [
        "Xem giúp khi rảnh nhé",
        "Lấy một cái nhìn",
        "Có thể nhìn không",
      ],
    } as any;

    const result = await grader.grade({
      userId: "user-1",
      exercise,
      answer: "Xem giúp khi rảnh nhé",
    });
    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(100);
    expect(llm.calls.length).toBe(1);
  });

  // ─── Objective grading: trap_detect ───

  it("grades correct trap_detect without calling LLM", async () => {
    const exercise = {
      type: "trap_detect",
      correctAnswer: "Dịch word-by-word bỏ qua ngữ cảnh",
      choices: [
        "Dịch word-by-word bỏ qua ngữ cảnh",
        "Dùng từ đồng nghĩa",
        "Lỗi ngữ pháp",
      ],
    } as any;

    const result = await grader.grade({
      userId: "user-1",
      exercise,
      answer: "Dịch word-by-word bỏ qua ngữ cảnh",
    });
    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(100);
    expect(llm.calls.length).toBe(1);
  });

  // ─── AI grading: production exercises ───

  it("routes phrase_production to AI grading (not exact match)", async () => {
    const exercise = {
      type: "phrase_production",
      correctAnswer: "I will push back the deadline.",
      promptVi: "Viết câu tiếng Anh sử dụng cụm `push back`",
      promptEn: "",
      rubricVi: "Dùng đúng push back trong ngữ cảnh",
    } as any;

    await grader.grade({
      userId: "user-1",
      lessonId: "lesson-1",
      exercise,
      answer: "We need to push back the release date.",
    });

    expect(llm.calls.length).toBe(1);
    expect(llm.calls[0].purpose).toBe("grading");
  });

  it("routes dialogue_completion to AI grading (not exact match)", async () => {
    const exercise = {
      type: "dialogue_completion",
      correctAnswer: "Sure, let me push back the meeting.",
      promptVi: "Hoàn thành hội thoại",
      promptEn: "A: Can we reschedule?\nB: ____",
      rubricVi: "Dùng push back tự nhiên trong hội thoại",
    } as any;

    await grader.grade({
      userId: "user-1",
      lessonId: "lesson-1",
      exercise,
      answer: "OK, I'll push back our meeting to next week.",
    });

    expect(llm.calls.length).toBe(1);
    expect(llm.calls[0].purpose).toBe("grading");
  });

  it("routes register_shift to AI grading (not exact match)", async () => {
    const exercise = {
      type: "register_shift",
      correctAnswer: "Let's circle back on this tomorrow.",
      promptVi: "Viết lại tự nhiên hơn",
      promptEn: "We should return to discuss this again tomorrow.",
      rubricVi: "Dùng circle back tự nhiên",
    } as any;

    await grader.grade({
      userId: "user-1",
      lessonId: "lesson-1",
      exercise,
      answer: "Can we circle back on this first thing tomorrow?",
    });

    expect(llm.calls.length).toBe(1);
    expect(llm.calls[0].purpose).toBe("grading");
  });

  // ─── AI grading: subjective exercises ───

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

  it("calls LLM and returns feedbackDetails on incorrect subjective attempt", async () => {
    const exercise = {
      type: "natural_translation",
      promptVi: "Dịch sang tiếng Việt tự nhiên",
      promptEn: "Could you take a look when you get a chance?",
      rubricVi: "Hiểu đúng nghĩa polite work request",
    } as any;

    llm.result = {
      score: 30,
      isCorrect: false,
      feedbackVi: "Bạn dịch cụm 'take a look' chưa chính xác.",
      naturalAnswer: "Bạn có thể xem giúp tôi khi có cơ hội không?",
      literalTranslationTrap: "lấy một cái nhìn",
      feedbackDetails: {
        whatWasWrong: "Dịch 'take a look' thành nghĩa đen là lấy một cái nhìn.",
        whyItWasWrong:
          "Cụm từ này mang nghĩa tự nhiên là 'xem giúp' chứ không dịch từng từ.",
        correctUnderstanding: "Xem giúp / kiểm tra giúp trong công việc.",
        mistakeType: "Dịch thô/nghĩa đen",
        nextPracticeItem: "Dịch câu: Can you take a look?",
        detailedExplanation: "Chi tiết về 'take a look'...",
      },
      error: {
        shouldSave: true,
        confidence: 90,
        errorType: "literal_translation",
        explanationVi: "Lỗi dịch nghĩa đen.",
        targetItem: "take a look",
      },
    };

    const result = await grader.grade({
      userId: "user-1",
      lessonId: "lesson-1",
      exercise,
      answer: "bạn có thể lấy một cái nhìn khi bạn có cơ hội",
    });

    expect(result.isCorrect).toBe(false);
    expect(result.feedbackDetails).toBeDefined();
    expect(result.feedbackDetails?.whatWasWrong).toBe(
      "Dịch 'take a look' thành nghĩa đen là lấy một cái nhìn."
    );
    expect(result.feedbackDetails?.mistakeType).toBe("Dịch thô/nghĩa đen");
  });

  // ─── Error handling ───

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
    expect(result.systemFailure).toBe(true);
    expect(result.feedbackVi).toContain("Chưa thể chấm câu trả lời này");
    expect(result.error?.shouldSave).toBe(false);
  });

  // ─── Normalization edge cases ───

  it("normalizes Unicode (NFKC), case, punctuation, and whitespace for objective answers", async () => {
    const exercise = {
      type: "cloze_phrase",
      correctAnswer: "look into",
      acceptableAnswers: [],
      promptVi: "Điền vào chỗ trống.",
      promptEn: "I'll ____ the issue.",
    } as any;

    // Extra whitespace + uppercase + trailing punctuation
    const result = await grader.grade({
      userId: "user-1",
      exercise,
      answer: "  Look  Into.  ",
    });
    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(100);
  });
});
