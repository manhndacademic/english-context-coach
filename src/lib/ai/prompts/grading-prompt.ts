export const gradingJsonShape = {
  score: "integer 0-100",
  isCorrect: "boolean",
  feedbackVi: "concise, actionable Vietnamese feedback (1-2 sentence summary)",
  naturalAnswer:
    "natural translation/answer in Vietnamese, showing the correct/natural way to translate/understand in context",
  literalTranslationTrap:
    "optional literal translation trap if the user fell into it (else null)",
  feedbackDetails:
    "null if isCorrect is true. Else object containing: whatWasWrong, whyItWasWrong, correctUnderstanding, mistakeType, nextPracticeItem, detailedExplanation",
  error:
    "null if isCorrect is true. Else object containing: shouldSave, confidence, errorType, explanationVi, targetItem",
};

export function gradingPrompt(input: {
  promptEn: string;
  promptVi: string;
  answer: string;
  rubricVi?: string | null;
  correctAnswer?: string | null;
  forceCorrect?: boolean;
}) {
  return [
    "Grade this Vietnamese learner answer.",
    "Prioritize whether the answer captures the English meaning in context naturally. Do not require word-by-word translation.",
    "Accept multiple natural Vietnamese answers when they preserve the meaning.",
    "Provide concise, actionable Vietnamese feedback.",
    input.forceCorrect
      ? "NOTE: The learner's answer is already confirmed correct by the local engine. You MUST set 'isCorrect' to true. Set 'feedbackDetails' to null and 'error' to null. Always provide 'naturalAnswer' in Vietnamese and a brief, encouraging Vietnamese reinforcement feedback message in 'feedbackVi'."
      : "",
    "If the learner's answer is correct/accurate:",
    "  - Set 'isCorrect' to true.",
    "  - Set 'feedbackDetails' to null and 'error' to null. Do not generate detailed error or feedback objects to save tokens.",
    "  - Always provide the 'naturalAnswer' in Vietnamese to show alternative natural translations/understandings.",
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
