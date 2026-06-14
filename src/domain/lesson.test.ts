import { describe, expect, it } from "vitest";
import { dedupeKeyPhrases, exerciseCompletenessIssues, findMatchingLessonFocus } from "./lesson";
import { getTextProcessor } from "@/domain/text";
import type { AnalysisResult, ExercisesResult } from "@/lib/ai/schemas";

const basePhrase: any = {
  conceptKey: "push_back",
  conceptPhrase: "push back",
  conceptMeaningVi: "hoãn lại / trì hoãn",
  meaningVi: "hoãn lại",
  meaningInContextVi: "dời việc này sang sau",
  exampleEn: "Can we push the review back to Friday?",
  exampleVi: "Mình có thể dời buổi review sang thứ Sáu không?",
  category: "phrasal_verb",
  difficulty: "B1",
} as const;

const baseAnalysis: any = {
  title: "Tin nhắn công việc",
  textType: "work_message",
  detectedLevel: "B1",
  summaryVi: "Người viết muốn hoãn việc.",
  naturalTranslationVi: "Chúng ta cần hoãn việc này.",
  contextExplanationVi: "Đây là cách nói trong công việc.",
  sentenceBreakdowns: [
    {
      sentence: "We need to push this back.",
      naturalMeaningVi: "Chúng ta cần dời việc này sang sau.",
      structureNotesVi: "Push back ở đây là hoãn lại, không phải đẩy vật lý.",
    },
  ],
  keyPhrases: [{ ...basePhrase, phrase: "push this back" }],
  lessonFocuses: [
    {
      title: "Yêu cầu hoãn lịch",
      conceptKey: "delay_request",
      conceptPhrase: "delay request",
      conceptMeaningVi: "yêu cầu hoãn lịch",
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
          conceptKey: "api_contract",
          conceptPhrase: "API contract",
          conceptMeaningVi: "thỏa thuận kỹ thuật API",
          meaningVi: "thỏa thuận kỹ thuật API",
          meaningInContextVi: "tài liệu cần chốt trước khi tiếp tục",
          exampleEn: "The API contract should be finalized before implementation.",
          exampleVi: "Tài liệu thống nhất API nên được chốt trước khi triển khai.",
          category: "technical_term",
          difficulty: "B2",
        },
      ],
      "We need to push this back until the API contract is finalized.",
      getTextProcessor(),
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
          {
            type: "cloze_phrase",
            phrase: "looks good",
            promptVi: "Điền cụm phù hợp.",
            promptEn: "It ____ to me.",
            correctAnswer: "looks good",
            acceptableAnswers: ["looks good"],
          },
          {
            type: "trap_choice",
            phrase: "looks good",
            promptVi: "Tránh bẫy dịch cho cụm:",
            promptEn: "Looks good.",
            choices: ["Trông ổn", "Nhìn tốt", "Xem đẹp"],
            correctAnswer: "Trông ổn",
          },
        ],
      },
      {
        ...baseAnalysis,
        keyPhrases: [
          {
            phrase: "looks good",
            conceptKey: "looks_good",
            conceptPhrase: "looks good",
            conceptMeaningVi: "ổn, được",
            meaningVi: "ổn, được",
            meaningInContextVi: "người nói thấy việc này ổn",
            exampleEn: "The schedule looks good.",
            exampleVi: "Lịch như vậy ổn.",
            category: "general_phrase",
            difficulty: "A2",
          },
        ],
        lessonFocuses: [
          {
            title: "Phản hồi đồng ý ngắn",
            conceptKey: "short_agreement",
            conceptPhrase: "phản hồi đồng ý ngắn",
            conceptMeaningVi: "thể hiện sự đồng ý ngắn gọn",
            category: "tone",
            explanationVi: "Câu này là phản hồi tích cực ngắn gọn.",
            difficulty: "A2",
          },
        ],
      },
      getTextProcessor(),
    );

    expect(issues).toEqual([]);
  });

  it("requires at least one focus question for a complete lesson", () => {
    const result: any = {
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
        {
          type: "cloze_phrase",
          phrase: "push this back",
          promptVi: "Điền cụm phù hợp.",
          promptEn: "We need to ____.",
          correctAnswer: "push this back",
          acceptableAnswers: ["push this back"],
        },
        {
          type: "trap_choice",
          phrase: "push this back",
          promptVi: "Tránh bẫy dịch cho cụm:",
          promptEn: "Push this back.",
          choices: ["Hoãn lại", "Đẩy cái này lại", "Bỏ qua"],
          correctAnswer: "Hoãn lại",
        },
      ],
    };

    expect(exerciseCompletenessIssues(result, baseAnalysis, getTextProcessor())).toContain(
      "A complete Lesson needs at least one LessonFocus Exercise.",
    );
  });

  describe("findMatchingLessonFocus", () => {
    const mockFocuses = [
      {
        title: "Cách sử dụng từ ngữ chuyên môn lịch sử",
        conceptKey: "academic_tone",
        conceptPhrase: "academic tone",
        category: "tone" as const,
        conceptMeaningVi: "giọng văn học thuật",
        explanationVi: "...",
        difficulty: "C1" as const,
      },
    ];

    it("matches exactly on conceptPhrase", () => {
      const match = findMatchingLessonFocus("academic tone", mockFocuses, getTextProcessor());
      expect(match).toBeDefined();
      expect(match?.conceptKey).toBe("academic_tone");
    });

    it("matches exactly on conceptKey (with space replacement)", () => {
      const match = findMatchingLessonFocus("academic tone", mockFocuses, getTextProcessor());
      expect(match).toBeDefined();
      expect(match?.conceptKey).toBe("academic_tone");
    });

    it("matches exactly on category", () => {
      const match = findMatchingLessonFocus("tone", mockFocuses, getTextProcessor());
      expect(match).toBeDefined();
      expect(match?.conceptKey).toBe("academic_tone");
    });

    it("matches substring for longer inputs", () => {
      const match = findMatchingLessonFocus("academic", mockFocuses, getTextProcessor());
      expect(match).toBeDefined();
      expect(match?.conceptKey).toBe("academic_tone");
    });

    it("returns undefined for non-matching inputs", () => {
      const match = findMatchingLessonFocus("random topic", mockFocuses, getTextProcessor());
      expect(match).toBeUndefined();
    });
  });
});
