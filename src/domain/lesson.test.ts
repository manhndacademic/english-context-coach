import { describe, expect, it } from "vitest";
import { dedupeKeyPhrases, exerciseCompletenessIssues } from "./lesson";
import type { AnalysisResult, ExercisesResult } from "@/lib/ai/schemas";

const basePhrase = {
  meaningVi: "hoãn lại",
  meaningInContextVi: "dời việc này sang sau",
  category: "phrasal_verb",
  difficulty: "B1",
} as const;

const baseAnalysis: AnalysisResult = {
  title: "Tin nhắn công việc",
  textType: "work_message",
  detectedLevel: "B1",
  summaryVi: "Người viết muốn hoãn việc.",
  naturalTranslationVi: "Chúng ta cần hoãn việc này.",
  contextExplanationVi: "Đây là cách nói trong công việc.",
  keyPhrases: [{ ...basePhrase, phrase: "push this back" }],
  lessonFocuses: [
    {
      title: "Yêu cầu hoãn lịch",
      category: "purpose",
      explanationVi: "Câu này nói về việc chờ hoặc dời lịch trong công việc.",
      difficulty: "B1",
    },
  ],
};

describe("lesson product rules", () => {
  it("deduplicates overlapping key phrases and keeps the phrase anchored to the source text", () => {
    const phrases = dedupeKeyPhrases(
      [
        { ...basePhrase, phrase: "push back" },
        { ...basePhrase, phrase: "push this back" },
        {
          phrase: "API contract",
          meaningVi: "thỏa thuận kỹ thuật API",
          meaningInContextVi: "tài liệu cần chốt trước khi tiếp tục",
          category: "technical_term",
          difficulty: "B2",
        },
      ],
      "We need to push this back until the API contract is finalized.",
    );

    expect(phrases.map((phrase) => phrase.phrase)).toEqual(["push this back", "API contract"]);
  });

  it("allows short text analysis with fewer than three key phrases", () => {
    const issues = exerciseCompletenessIssues(
      {
        exercises: [
          {
            type: "meaning_choice",
            phrase: "looks good",
            promptVi: "Cụm này có nghĩa tự nhiên là gì?",
            choices: ["Ổn rồi", "Nhìn đẹp", "Tốt nghiệp"],
            correctAnswer: "Ổn rồi",
          },
          {
            type: "focus_question",
            focus: "Phản hồi đồng ý ngắn",
            promptVi: "Tin nhắn này thể hiện thái độ gì?",
            rubricVi: "Câu trả lời cần nêu đây là phản hồi đồng ý/ngầm chấp thuận ngắn gọn.",
          },
          {
            type: "natural_translation",
            phrase: "looks good",
            promptVi: "Dịch tự nhiên sang tiếng Việt.",
            promptEn: "Thanks, looks good.",
            rubricVi: "Bản dịch cần tự nhiên và thể hiện sự đồng ý.",
          },
        ],
      },
      {
        ...baseAnalysis,
        keyPhrases: [
          {
            phrase: "looks good",
            meaningVi: "ổn, được",
            meaningInContextVi: "người nói thấy việc này ổn",
            category: "general_phrase",
            difficulty: "A2",
          },
        ],
        lessonFocuses: [
          {
            title: "Phản hồi đồng ý ngắn",
            category: "tone",
            explanationVi: "Câu này là phản hồi tích cực ngắn gọn.",
            difficulty: "A2",
          },
        ],
      },
    );

    expect(issues).toEqual([]);
  });

  it("requires at least one focus question for a complete lesson", () => {
    const result: ExercisesResult = {
      exercises: [
        {
          type: "meaning_choice",
          phrase: "push this back",
          promptVi: "Cụm này có nghĩa gì?",
          choices: ["Hoãn lại", "Đẩy lại", "Bỏ qua"],
          correctAnswer: "Hoãn lại",
        },
        {
          type: "cloze_phrase",
          phrase: "push this back",
          promptVi: "Điền cụm phù hợp.",
          promptEn: "We need to ____.",
          correctAnswer: "push this back",
          acceptableAnswers: ["push this back"],
        },
        {
          type: "natural_translation",
          phrase: "push this back",
          promptVi: "Dịch tự nhiên sang tiếng Việt.",
          promptEn: "We need to push this back.",
          rubricVi: "Câu trả lời cần nêu nghĩa hoãn/dời lại.",
        },
      ],
    };

    expect(exerciseCompletenessIssues(result, baseAnalysis)).toContain(
      "A complete Lesson needs at least one LessonFocus Exercise.",
    );
  });
});
