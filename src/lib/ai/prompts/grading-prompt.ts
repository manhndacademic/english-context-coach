export const gradingJsonShape = {
  score: "integer 0-100",
  isCorrect: "boolean",
  feedbackVi: "Vietnamese feedback, max 1-2 short sentences, max 300 chars",
  naturalAnswer:
    "exactly ONE best Vietnamese answer for this context, max 300 chars; never list alternatives",
  literalTranslationTrap:
    "optional short literal translation trap only when truly needed, max 300 chars (else null)",
  feedbackDetails:
    "null if isCorrect is true. Else object containing short bounded strings: whatWasWrong, whyItWasWrong, correctUnderstanding, mistakeType, nextPracticeItem, detailedExplanation (max 800 chars)",
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
    "Return strict compact JSON only. No markdown. No explanatory text outside JSON.",
    "Use concise Vietnamese. Do not generate long lists or repeated patterns.",
    "Do not write sequences like 'or ..., or ..., or ...'. Do not list multiple alternative answers unless the prompt explicitly asks for alternatives.",
    "naturalAnswer MUST be exactly ONE best Vietnamese answer for the context, not several options. Keep naturalAnswer under 300 characters, ideally 160-250 characters.",
    "feedbackVi MUST be at most 1-2 short Vietnamese sentences.",
    "literalTranslationTrap must be short and only present when there is a real word-by-word translation trap; otherwise use null.",
    "feedbackDetails.detailedExplanation should be informative but bounded: max 800 characters, ideally 500-800 characters only when the learner is wrong.",
    "Prioritize whether the answer captures the English meaning in context naturally. Do not require word-by-word translation.",
    "Accept the learner answer when it preserves the meaning naturally, but still output only one best naturalAnswer.",
    input.forceCorrect
      ? "NOTE: The learner's answer is already confirmed correct by the local engine. You MUST set 'isCorrect' to true. Set 'feedbackDetails' to null and 'error' to null. Always provide exactly one Vietnamese 'naturalAnswer' and brief encouraging Vietnamese 'feedbackVi'."
      : "",
    "If the learner's answer is correct/accurate:",
    "  - Set 'isCorrect' to true.",
    "  - Set 'feedbackDetails' to null and 'error' to null. Do not generate detailed error or feedback objects to save tokens.",
    "  - Provide exactly one concise 'naturalAnswer' in Vietnamese.",
    "If the learner's answer is wrong or inaccurate:",
    "  - Set 'isCorrect' to false.",
    "  - Provide exactly one concise 'naturalAnswer' in Vietnamese.",
    "  - If they fell into a literal/word-by-word translation trap, specify it briefly in 'literalTranslationTrap'.",
    "  - Populate feedbackDetails with: whatWasWrong (max 300 chars), whyItWasWrong (max 500 chars), correctUnderstanding (max 500 chars), mistakeType (max 100 chars), nextPracticeItem (max 300 chars or null), detailedExplanation (max 800 chars).",
    "  - Populate the 'error' object only for a real misunderstanding worth saving. Set shouldSave and confidence (0-100). Keep explanationVi max 500 chars and targetItem max 200 chars.",
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
