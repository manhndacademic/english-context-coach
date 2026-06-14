export const gradingJsonShape = {
  score: "integer 0-100",
  isCorrect: "boolean",
  feedbackVi:
    "concise, actionable Vietnamese learner-friendly feedback (keep it as a brief 1-2 sentence summary)",
  naturalAnswer:
    "optional natural translation/answer in Vietnamese, showing the correct/natural way to translate/understand in context",
  literalTranslationTrap:
    "optional literal/word-by-word Vietnamese translation trap if the user fell into it (e.g. 'lấy một cái nhìn' for 'take a look')",
  feedbackDetails: {
    whatWasWrong:
      "Clear Vietnamese description of what was wrong in the learner's answer (1 sentence)",
    whyItWasWrong:
      "Vietnamese explanation of why the answer was wrong (e.g. literal translation trap, wrong context/register) (1-2 sentences)",
    correctUnderstanding:
      "Vietnamese description of the natural, context-appropriate meaning or translation (1-2 sentences)",
    mistakeType:
      "User-friendly name of the mistake type in Vietnamese (e.g. Dịch thô/nghĩa đen, Sai ngữ cảnh, Thiếu sắc thái, Lỗi cụm động từ, v.v.)",
    nextPracticeItem:
      "optional small next practice suggestion in Vietnamese (e.g., a simple sentence to translate or a phrase to review, or null/omitted)",
    detailedExplanation:
      "A longer, detailed Vietnamese explanation for the 'Explain more' ('Giải thích thêm') section, covering grammar/nuance/subtlety details if helpful (2-4 sentences)",
  },
  error: {
    shouldSave:
      "boolean: true if this is a high-value structured error that should be saved to the learner's error memory for later review (e.g., a real misunderstanding of a phrasal verb, collocation, literal trap, context or tone, etc. - false if it is just a minor typo, layout/formatting issue, or random noise)",
    confidence:
      "integer 0-100: AI confidence score that this structured error is correct and worth saving",
    errorType:
      "literal_translation | phrase_misunderstanding | technical_term_misunderstanding | phrasal_verb_error | collocation_error | grammar_structure_misread | pronoun_reference_misread | tone_register_misread | missing_context",
    explanationVi: "concise Vietnamese explanation of the error",
    targetItem:
      "the specific English key phrase or structure that was misunderstood/translated incorrectly (e.g., 'take a look')",
  },
};

export function gradingPrompt(input: {
  promptEn: string;
  promptVi: string;
  answer: string;
  rubricVi?: string | null;
  correctAnswer?: string | null;
}) {
  return [
    "Grade this Vietnamese learner answer.",
    "Prioritize whether the answer captures the English meaning in context naturally. Do not require word-by-word translation.",
    "Grading translation must focus on contextual meaning, not exact matching. Accept multiple natural Vietnamese answers when they preserve the meaning.",
    "Provide concise, actionable Vietnamese feedback.",
    "Identify if the learner fell into any literal translation traps (e.g. translating 'take a look' as 'lấy một cái nhìn').",
    "If the learner's answer is wrong or inaccurate:",
    "  - Set 'isCorrect' to false.",
    "  - Provide the 'naturalAnswer' in Vietnamese.",
    "  - If they fell into a literal/word-by-word translation trap, specify it in 'literalTranslationTrap'.",
    "  - Populate the 'feedbackDetails' object with the 6 structured fields: whatWasWrong, whyItWasWrong, correctUnderstanding, mistakeType, nextPracticeItem (optional), and detailedExplanation. Keep feedbackDetails.detailedExplanation highly informative (grammar patterns, context clues). Keep the top-level 'feedbackVi' as a concise 1-2 sentence high-level summary.",
    "  - Populate the 'error' object with structured details for memory if it is a real misunderstanding (not a minor spelling typo). Set 'shouldSave' to true and 'confidence' to your confidence score (0-100). Keep the Vietnamese feedback and error explanation concise.",
    "Return strict JSON only. No markdown.",
    "JSON shape:",
    JSON.stringify(gradingJsonShape),
    `Prompt VI: ${input.promptVi}`,
    `Prompt EN: ${input.promptEn}`,
    `Rubric VI: ${input.rubricVi ?? ""}`,
    input.correctAnswer
      ? `Correct/Expected Answer: ${input.correctAnswer}`
      : "",
    `Learner answer: ${input.answer}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
