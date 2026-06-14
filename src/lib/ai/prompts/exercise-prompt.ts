import type { AnalysisResult } from "../schemas";

export const exercisesJsonShape = {
  exercises: [
    {
      type: "meaning_choice",
      phrase: "key phrase",
      promptVi: "Vietnamese prompt",
      choices: ["choice", "choice", "choice"],
      correctAnswer: "exact choice",
    },
    {
      type: "cloze_phrase",
      phrase: "key phrase",
      promptVi: "Vietnamese prompt",
      promptEn: "English sentence with ____",
      correctAnswer: "phrase",
      acceptableAnswers: ["phrase"],
    },
    {
      type: "natural_translation",
      phrase: "key phrase",
      promptVi:
        "Vietnamese prompt asking the learner to translate English into natural Vietnamese",
      promptEn: "English sentence to translate into Vietnamese",
      rubricVi: "Vietnamese grading rubric",
    },
    {
      type: "focus_question",
      focus: "lesson focus title",
      promptVi:
        "Vietnamese open-ended prompt about whole-text meaning, tone, structure, or purpose",
      promptEn: "optional English source sentence or excerpt",
      rubricVi: "Vietnamese grading rubric",
    },
    {
      type: "trap_choice",
      phrase: "key phrase",
      promptVi:
        "Vietnamese prompt asking the learner to choose the natural Vietnamese translation, avoiding literal traps",
      promptEn: "English sentence containing the key phrase",
      choices: [
        "natural translation (correct)",
        "literal trap 1 (wrong)",
        "literal trap 2 (wrong)",
      ],
      correctAnswer: "natural translation (correct)",
      acceptableAnswers: ["natural translation (correct)"],
    },
    {
      type: "phrase_production",
      phrase: "key phrase",
      promptVi:
        "Vietnamese prompt asking the learner to write/dịch an English sentence containing the key phrase to express a specific Vietnamese concept",
      promptEn: "optional English hint or reference structure",
      correctAnswer: "expected English sentence",
      acceptableAnswers: [
        "alternative correct English sentence 1",
        "alternative correct English sentence 2",
      ],
      rubricVi:
        "Vietnamese grading rubric detailing correct phrase use and grammar",
    },
    {
      type: "dialogue_completion",
      phrase: "key phrase",
      promptVi:
        "Vietnamese prompt asking the learner to write B's response in a mock dialogue using the key phrase",
      promptEn:
        "Dialogue text, e.g. 'A: Hey, can we move the meeting to Friday?\nB: [Write your reply using 'push back']'",
      correctAnswer: "expected B's reply sentence",
      acceptableAnswers: [
        "alternative correct reply 1",
        "alternative correct reply 2",
      ],
      rubricVi:
        "Vietnamese grading rubric checking dialogue appropriateness and key phrase usage",
    },
    {
      type: "register_shift",
      phrase: "key phrase",
      promptVi:
        "Vietnamese prompt asking the learner to rewrite a dry or awkward English sentence to use the key phrase naturally",
      promptEn: "awkward or dry English sentence to rewrite",
      correctAnswer:
        "expected natural/idiomatic English sentence using the phrase",
      acceptableAnswers: ["alternative natural English sentence 1"],
      rubricVi: "Vietnamese grading rubric checking register and phrase usage",
    },
    {
      type: "trap_detect",
      phrase: "key phrase",
      promptVi:
        "Vietnamese prompt presenting a bad word-by-word literal translation trap, asking to choose why it is wrong",
      promptEn:
        "English sentence containing the phrase, followed by its bad literal translation",
      choices: [
        "correct explanation of the translation trap",
        "incorrect explanation 1",
        "incorrect explanation 2",
      ],
      correctAnswer: "correct explanation of the translation trap",
    },
  ],
};

export function exercisesPrompt(analysis: AnalysisResult) {
  return [
    "Create 5-10 practice exercises for Vietnamese learners using the validated key phrases and lesson focuses. Strict JSON only.",
    `Exercise types:
- meaning_choice: Multiple-choice on phrase meaning. Requires "choices" array (3-4 items). Graded locally.
- cloze_phrase: Fill in the blank. "promptEn" must contain "____" (4 underscores) for the missing phrase. Graded locally.
- natural_translation: Translate English sentence into natural Vietnamese. No choices. AI-graded.
- focus_question: Open-ended question about text meaning/tone/structure. Targets a lessonFocus. No choices. AI-graded.
- trap_choice: Choose natural translation avoiding literal traps. "choices" array must have 1 natural (correct) + 2-3 literal traps (wrong). Graded locally.
- phrase_production: Write English sentence containing key phrase. No choices. AI-graded.
- dialogue_completion: Complete B's response in A/B dialogue using key phrase. "promptEn" shows dialogue with B's placeholder. No choices. AI-graded.
- register_shift: Rewrite dry/awkward English sentence using key phrase naturally. No choices. AI-graded.
- trap_detect: Identify/explain translation trap. Requires "choices" array (3-4 items) for explanation. Graded locally.`,
    `Wording constraints for promptVi:
- cloze_phrase: "Điền từ/cụm từ phù hợp vào chỗ trống."
- meaning_choice: "Cụm \`X\` trong câu trên có nghĩa gần nhất với?"
- trap_choice: "Chọn bản dịch tự nhiên nhất, tránh dịch từng từ."
- phrase_production: "Viết một câu tiếng Anh sử dụng cụm \`X\` để diễn đạt ý: ..."
- dialogue_completion: "Viết câu trả lời của B bằng tiếng Anh, sử dụng cụm \`X\`."
- register_shift: "Viết lại câu dưới đây tự nhiên hơn bằng cách sử dụng cụm \`X\`."
- natural_translation: "Dịch câu sau sang tiếng Việt tự nhiên."
- Do not reveal the answer or hint at the correct response in promptVi.`,
    "Include at least one focus_question. Ensure every key phrase has 1-2 associated exercises (mix passive and active types).",
    "Wrap English phrases/terms in markdown backticks (e.g. `unlike`).",
    "JSON shape:",
    JSON.stringify(exercisesJsonShape),
    "Analysis data:",
    JSON.stringify(analysis),
  ].join("\n\n");
}
