import { describe, expect, it } from "vitest";
import { analysisSchema, exercisesSchema } from "./schemas";

describe("AI schemas", () => {
  it("accepts short-text analysis with one key phrase and one lesson focus", () => {
    const result = analysisSchema.safeParse({
      title: "Short work reply",
      textType: "work_message",
      detectedLevel: "A2",
      summaryVi: "Người viết phản hồi rằng mọi thứ ổn.",
      naturalTranslationVi: "Cảm ơn, vậy là ổn rồi.",
      contextExplanationVi: "Đây là phản hồi ngắn trong công việc.",
      keyPhrases: [
        {
          phrase: "looks good",
          meaningVi: "ổn, được",
          meaningInContextVi: "người nói chấp nhận hoặc thấy không có vấn đề",
          category: "general_phrase",
          difficulty: "A2",
        },
      ],
      lessonFocuses: [
        {
          title: "Phản hồi đồng ý ngắn",
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
});
