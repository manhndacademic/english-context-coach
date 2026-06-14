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
    "Create practice exercises for Vietnamese learners from these validated key phrases and lesson focuses.",
    "Return strict JSON only. No markdown.",
    "Generate between 5 and 10 exercises total.",

    // ── Strict exercise type definitions ──
    `Exercise type definitions — follow strictly:
- meaning_choice: Multiple-choice quiz asking what a phrase means. MUST include a "choices" array (3-4 items). User picks one choice. Graded locally by exact match.
- cloze_phrase: Fill in the blank. "promptEn" MUST contain ____ (four underscores) where the missing phrase goes. User types the answer. Graded locally.
- natural_translation: Translate an English sentence into natural Vietnamese. No choices. AI-graded by contextual meaning.
- focus_question: Open-ended question about whole-text meaning, tone, structure, or purpose. Targets a lessonFocus. No choices. AI-graded.
- trap_choice: Choose the natural Vietnamese translation and avoid literal traps. MUST include a "choices" array with 1 natural (correct) + 2-3 literal traps (wrong). Graded locally.
- phrase_production: Write an English sentence containing the key phrase. No choices. AI-graded — accept any correct sentence using the phrase.
- dialogue_completion: Complete B's response in an A/B dialogue using the key phrase. "promptEn" must show the dialogue with a placeholder for B. No choices. AI-graded.
- register_shift: Rewrite an awkward or overly literal English sentence to use the key phrase naturally. No choices. AI-graded.
- trap_detect: Identify and explain a translation trap. MUST include a "choices" array (3-4 items). User picks the correct explanation. Graded locally.`,

    // ── promptVi quality constraints ──
    `IMPORTANT constraints for promptVi wording:
- cloze_phrase: promptVi MUST be "Điền từ/cụm từ phù hợp vào chỗ trống." — do NOT write "Chọn từ phù hợp" (this is NOT multiple choice).
- meaning_choice: promptVi MUST ask about meaning, e.g. "Cụm \`X\` trong câu trên có nghĩa gần nhất với?"
- trap_choice: promptVi MUST warn about literal traps, e.g. "Chọn bản dịch tự nhiên nhất, tránh dịch từng từ."
- phrase_production: promptVi MUST ask user to write an English sentence, e.g. "Viết một câu tiếng Anh sử dụng cụm \`X\` để diễn đạt ý: ..."
- dialogue_completion: promptVi MUST ask user to write B's English reply, e.g. "Viết câu trả lời của B bằng tiếng Anh, sử dụng cụm \`X\`."
- register_shift: promptVi MUST ask to rewrite, e.g. "Viết lại câu dưới đây tự nhiên hơn bằng cách sử dụng cụm \`X\`."
- natural_translation: promptVi MUST ask for Vietnamese translation, e.g. "Dịch câu sau sang tiếng Việt tự nhiên."
- Do NOT use promptVi wording that reveals the answer or hints at the exact correct response.`,

    "Include at least one focus_question that targets a lessonFocus.",
    "Ensure every key phrase has at least 1-2 associated exercises. Mix passive identification exercises (like meaning_choice, cloze_phrase, trap_choice, or trap_detect) with active production exercises (like phrase_production, dialogue_completion, register_shift, or natural_translation).",
    "Natural translation and open-ended production exercises should judge contextual meaning, register, and correctness, not exact word-by-word matches.",
    "When writing exercise prompts (promptVi, promptEn) or choices, wrap English phrases or terms under discussion in markdown backticks (e.g., `unlike` or `however`). Avoid wrapping them in raw single quotes ('...').",
    "JSON shape:",
    JSON.stringify(exercisesJsonShape),
    "Validated analysis:",
    JSON.stringify(analysis),
  ].join("\n\n");
}
