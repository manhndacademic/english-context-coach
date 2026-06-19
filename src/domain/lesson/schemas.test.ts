import { describe, expect, it } from "vitest";
import { analysisSchema, exercisesSchema } from "./schemas";

describe("Lesson AI schemas", () => {
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
});
