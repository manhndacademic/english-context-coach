export const reviewPromptJsonShape = {
  reviewType:
    "natural_translation | cloze_phrase | dialogue_completion | trap_choice | trap_detect",
  reviewPromptEn:
    "new English practice sentence or challenge containing the concept (with a blank '____' for cloze/dialogue formats)",
  reviewPromptVi:
    "Vietnamese prompt instructions suitable for the selected reviewType",
  reviewRubricVi:
    "Vietnamese grading rubric containing key context details and translation traps to check",
  reviewCorrectAnswer:
    "canonical correct natural Vietnamese translation or option choice text",
  reviewAcceptableAnswers: [
    "alternative correct natural Vietnamese translation 1",
    "alternative correct natural Vietnamese translation 2",
  ],
  reviewChoices: [
    "choice option 1 (correct choice)",
    "choice option 2 (incorrect translation trap)",
    "choice option 3 (distractor)",
  ],
};

export function reviewPromptGenerationPrompt(input: {
  conceptPhrase: string;
  conceptMeaningVi: string;
  category: string;
  errorType: string;
}) {
  return [
    "You are English Context Coach for Vietnamese learners.",
    "Create a new context review practice exercise for a learner who previously misunderstood this concept.",
    "Concept English phrase: " + input.conceptPhrase,
    "Concept Vietnamese meaning: " + input.conceptMeaningVi,
    "Concept category: " + input.category,
    "Previous error type: " + input.errorType,
    "Instructions:",
    "1. Dynamically select the best review exercise type (`reviewType`) based on the concept and the previous error, while actively aiming to diversify the exercise types. Avoid overusing `natural_translation` for every general phrase; instead, challenge the learner with varied formats to build deeper mastery:",
    "   - Use `cloze_phrase` or `dialogue_completion` to check active recall and context use of phrasal verbs, collocations, or common vocabulary.",
    "   - Use `trap_choice` or `trap_detect` to help the learner identify and dodge literal/word-by-word translation traps.",
    "   - Use `natural_translation` primarily to assess natural Vietnamese phrasing of full sentences, but do not make it the default for everything.",
    "2. Generate a NEW, privacy-safe, realistic English sentence (`reviewPromptEn`) that uses the concept phrase naturally. Do not reuse any project names, private details, or sensitive context.",
    '   - For `cloze_phrase` or `dialogue_completion`, replace the concept phrase in `reviewPromptEn` with a blank: e.g. "Can we ____ the meeting back?" for "push back".',
    "   - Otherwise, `reviewPromptEn` must be a complete, grammatically correct full sentence.",
    "3. Generate a clear Vietnamese instruction prompt (`reviewPromptVi`) suitable for the selected type:",
    '   - For `natural_translation`: "Dịch câu sau sang tiếng Việt tự nhiên."',
    '   - For `cloze_phrase`: "Điền từ/cụm từ phù hợp vào chỗ trống để hoàn thành câu."',
    '   - For `dialogue_completion`: "Hoàn thành câu trả lời của B bằng từ/cụm từ phù hợp."',
    '   - For `trap_choice` / `trap_detect`: "Chọn bản dịch tự nhiên nhất, tránh bẫy dịch từng từ."',
    "4. If `reviewType` is `trap_choice` or `trap_detect`, generate `reviewChoices` with 3 to 4 options in Vietnamese. One option must be the exact correct answer matching `reviewCorrectAnswer`, another option must be the literal translation trap, and others should be plausible distractors. For other types, set `reviewChoices` to null.",
    "5. Provide a clear correct response (`reviewCorrectAnswer`) and 1-3 alternative responses (`reviewAcceptableAnswers`).",
    "   - For translation types, these must be full natural translations of the entire generated sentence (`reviewPromptEn`).",
    "6. Provide a short Vietnamese grading rubric (`reviewRubricVi`) highlighting what key meaning components the response must preserve and what word-by-word traps to penalize.",
    "7. CRITICAL: Do NOT wrap the concept phrase, vocabulary words, or any words in single quotes ('...') or backticks (`...`) inside generated English or Vietnamese sentences (such as `reviewPromptEn`, `reviewCorrectAnswer`, or `reviewAcceptableAnswers`). The sentences must look natural as they would appear in regular written text.",
    "8. Return strict JSON only. No markdown.",
    "JSON shape:",
    JSON.stringify(reviewPromptJsonShape),
  ].join("\n\n");
}
