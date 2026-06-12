import { describe, expect, it } from "vitest";
import { analysisSchema, exercisesSchema, gradingSchema } from "./schemas";

describe("AI schemas", () => {
  it("accepts short-text analysis with one key phrase and one lesson focus", () => {
    const result = analysisSchema.safeParse({
      title: "Short work reply",
      textType: "work_message",
      detectedLevel: "A2",
      summaryVi: "Người viết phản hồi rằng mọi thứ ổn.",
      naturalTranslationVi: "Cảm ơn, vậy là ổn rồi.",
      contextExplanationVi: "Đây là phản hồi ngắn trong công việc.",
      sentenceBreakdowns: [
        {
          sentence: "Thanks, looks good.",
          naturalMeaningVi: "Người viết cảm ơn và xác nhận mọi thứ ổn.",
          structureNotesVi: "Looks good là cách nói ngắn để chấp thuận hoặc xác nhận.",
        },
      ],
      keyPhrases: [
        {
          phrase: "looks good",
          conceptKey: "looks_good",
          conceptPhrase: "looks good",
          conceptMeaningVi: "ổn, được",
          meaningVi: "ổn, được",
          meaningInContextVi: "người nói chấp nhận hoặc thấy không có vấn đề",
          exampleEn: "The updated draft looks good to me.",
          exampleVi: "Bản nháp đã cập nhật ổn với tôi.",
          category: "general_phrase",
          difficulty: "A2",
        },
      ],
      lessonFocuses: [
        {
          title: "Phản hồi đồng ý ngắn",
          conceptKey: "short_agreement",
          conceptPhrase: "phản hồi đồng ý ngắn",
          conceptMeaningVi: "thể hiện sự đồng ý ngắn gọn và tích cực",
          category: "tone",
          explanationVi: "Tin nhắn thể hiện sự đồng ý ngắn gọn và tích cực.",
          difficulty: "A2",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts focus question exercises", () => {
    const result = exercisesSchema.safeParse({
      exercises: [
        {
          type: "focus_question",
          focus: "Lời nhờ vả lịch sự",
          promptVi: "Câu này lịch sự ở điểm nào?",
          promptEn: "Could you take a look when you get a chance?",
          rubricVi: "Câu trả lời cần nêu được sắc thái nhờ vả mềm và không gây áp lực.",
        },
        {
          type: "meaning_choice",
          phrase: "take a look",
          promptVi: "Cụm này nghĩa là gì?",
          choices: ["xem giúp", "lấy một cái nhìn", "nhìn lâu"],
          correctAnswer: "xem giúp",
        },
        {
          type: "natural_translation",
          phrase: "take a look",
          promptVi: "Dịch tự nhiên sang tiếng Việt.",
          promptEn: "Could you take a look when you get a chance?",
          rubricVi: "Bản dịch cần tự nhiên, lịch sự, và không dịch từng từ.",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

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
        explanationVi: "Dịch word-by-word cụm 'take a look' là 'lấy một cái nhìn' thay vì 'xem giúp / kiểm tra giúp'.",
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
});
