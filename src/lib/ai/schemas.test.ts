import { describe, expect, it } from "vitest";
import { analysisSchema, exercisesSchema, gradingSchema } from "./schemas";

describe("AI schemas", () => {
  it("accepts short-text analysis with one key phrase and one lesson focus", () => {
    const result = analysisSchema.safeParse({
      title: "Short work reply",
      textType: "work_message",
      inputMode: "understand_and_practice",
      detectedLevel: "A2",
      summaryVi: "Người viết phản hồi rằng mọi thứ ổn.",
      naturalTranslationVi: "Cảm ơn, vậy là ổn rồi.",
      contextExplanationVi: "Đây là phản hồi ngắn trong công việc.",
      sentenceBreakdowns: [
        {
          sentence: "Thanks, looks good.",
          naturalMeaningVi: "Người viết cảm ơn và xác nhận mọi thứ ổn.",
          structureNotesVi:
            "Looks good là cách nói ngắn để chấp thuận hoặc xác nhận.",
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
          examples: [
            {
              exampleEn: "The updated draft looks good to me.",
              exampleVi: "Bản nháp đã cập nhật ổn với tôi.",
            },
          ],
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
          rubricVi:
            "Câu trả lời cần nêu được sắc thái nhờ vả mềm và không gây áp lực.",
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

  it("accepts the 5 new smart exercise types", () => {
    const result = exercisesSchema.safeParse({
      exercises: [
        {
          type: "trap_choice",
          phrase: "take a look",
          promptVi: "Chọn câu dịch tự nhiên...",
          promptEn: "Take a look.",
          choices: ["Xem giúp", "Lấy một cái nhìn", "Nhìn xem"],
          correctAnswer: "Xem giúp",
        },
        {
          type: "phrase_production",
          phrase: "take a look",
          promptVi: "Hãy đặt câu tiếng Anh...",
          promptEn: "Could you...",
          correctAnswer: "Could you take a look?",
          rubricVi: "Phải dùng cụm 'take a look' chính xác.",
        },
        {
          type: "dialogue_completion",
          phrase: "take a look",
          promptVi: "Hoàn thành hội thoại...",
          promptEn: "A: Check this.\nB: [reply]",
          correctAnswer: "I will take a look.",
          rubricVi: "B phản hồi tự nhiên.",
        },
        {
          type: "register_shift",
          phrase: "take a look",
          promptVi: "Viết lại câu...",
          promptEn: "Inspect this.",
          correctAnswer: "Please take a look at this.",
          rubricVi: "Viết lại tự nhiên hơn.",
        },
        {
          type: "trap_detect",
          phrase: "take a look",
          promptVi: "Vì sao câu dịch này sai...",
          promptEn: "Take a look = Lấy một cái nhìn",
          choices: ["Dịch word-by-word", "Sai ngữ pháp", "Không đúng sắc thái"],
          correctAnswer: "Dịch word-by-word",
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
});
