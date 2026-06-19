import { describe, expect, it } from "vitest";
import { gradingSchema } from "./schemas";

describe("Memory AI schemas", () => {
  it("accepts gradingSchema with naturalAnswer, literalTranslationTrap, and error structured data", () => {
    const result = gradingSchema.safeParse({
      score: 0,
      isCorrect: false,
      feedbackVi: "Bạn đã dịch sai cụm từ 'take a look' thành nghĩa đen.",
      naturalAnswer: "Bạn có thể xem giúp tôi khi có cơ hội không?",
      literalTranslationTrap: "lấy một cái nhìn",
      error: {
        shouldSave: true,
        confidence: 90,
        errorType: "literal_translation",
        explanationVi:
          "Dịch word-by-word cụm 'take a look' là 'lấy một cái nhìn' thay vì 'xem giúp / kiểm tra giúp'.",
        targetItem: "take a look",
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts gradingSchema without error object when correct", () => {
    const result = gradingSchema.safeParse({
      score: 100,
      isCorrect: true,
      feedbackVi: "Chính xác, bản dịch tự nhiên và đúng ngữ cảnh.",
      naturalAnswer: "Bạn có thể xem giúp tôi khi có cơ hội không?",
    });

    expect(result.success).toBe(true);
  });

  it("accepts gradingSchema with feedbackDetails", () => {
    const result = gradingSchema.safeParse({
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
        nextPracticeItem: "Dịch câu: Can you take a look at the code?",
        detailedExplanation: "Chi tiết ngữ pháp về 'take a look'...",
      },
      error: {
        shouldSave: true,
        confidence: 95,
        errorType: "literal_translation",
        explanationVi: "Lỗi dịch nghĩa đen.",
        targetItem: "take a look",
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts gradingSchema with null error and null feedbackDetails when correct", () => {
    const result = gradingSchema.safeParse({
      score: 100,
      isCorrect: true,
      feedbackVi: "Chính xác!",
      naturalAnswer: "Bạn có thể xem giúp tôi khi có cơ hội không?",
      feedbackDetails: null,
      error: null,
    });

    expect(result.success).toBe(true);
  });

  it("rejects gradingSchema with invalid feedbackDetails structure", () => {
    const result = gradingSchema.safeParse({
      score: 30,
      isCorrect: false,
      feedbackVi: "Bạn dịch cụm 'take a look' chưa chính xác.",
      feedbackDetails: {
        whatWasWrong: "Chỉ có một trường, thiếu các trường bắt buộc khác.",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects gradingSchema with naturalAnswer over the bounded max length", () => {
    const result = gradingSchema.safeParse({
      score: 80,
      isCorrect: true,
      feedbackVi: "Ổn rồi.",
      naturalAnswer: "a".repeat(3001),
    });

    expect(result.success).toBe(false);
  });
});
