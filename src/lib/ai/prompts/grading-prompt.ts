export const gradingJsonShape = {
  score: "integer 0-100",
  isCorrect: "boolean",
  feedbackVi:
    "Vietnamese feedback, max 1-2 short sentences, max 200 chars, no HTML tags",
  naturalAnswer:
    "exactly ONE best correct answer in the expected target language (English or Vietnamese depending on context) for this context, max 200 chars; never list alternatives, no HTML tags",
  literalTranslationTrap:
    "optional short literal translation trap only when truly needed, max 200 chars (else JSON null)",
  feedbackDetails:
    "JSON null if isCorrect is true. Else object containing short bounded strings: whatWasWrong (max 200 chars), whyItWasWrong (max 300 chars), correctUnderstanding (max 300 chars), mistakeType (max 100 chars), nextPracticeItem (max 200 chars or JSON null), detailedExplanation (max 400 chars). All strings must be clean plain text without HTML.",
  error:
    "JSON null if isCorrect is true. Else object containing: shouldSave, confidence, errorType, explanationVi (max 300 chars), targetItem (max 150 chars). All strings must be clean plain text without HTML.",
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
    "Return strict compact JSON only. No markdown fences unless required, no explanatory text outside JSON.",
    "Use concise Vietnamese. Do not generate long lists or repeated patterns.",
    "Do not write sequences like 'or ..., or ..., or ...'. Do not list multiple alternative answers unless the prompt explicitly asks for alternatives.",
    "CRITICAL: Do not generate any HTML tags (such as <p>, <span>, <b>, <br>) in any string field. All text must be clean plain text or basic markdown.",
    "CRITICAL: For optional/nullable fields (such as `literalTranslationTrap`, `nextPracticeItem`, or `error`), if there is no value, set it to JSON `null` (not a string) or omit the key entirely. NEVER write literal text placeholders like 'null', 'undefined', '(null)', '(null)null,', 'null null', or 'none'.",
    "naturalAnswer MUST be exactly ONE best correct answer in the expected target language (English or Vietnamese depending on context) for the context, not several options. Keep naturalAnswer under 300 characters, ideally 160-250 characters.",
    "feedbackVi MUST be at most 1-2 short Vietnamese sentences.",
    "literalTranslationTrap must be short and only present when there is a real word-by-word translation trap; otherwise use JSON null.",
    "feedbackDetails.detailedExplanation should be informative but bounded: max 800 characters, ideally 500-800 characters only when the learner is wrong.",
    "Prioritize whether the answer captures the English meaning in context naturally. Do not require word-by-word translation.",
    "Accept the learner answer when it preserves the meaning naturally, but still output only one best naturalAnswer.",
    input.forceCorrect
      ? "NOTE: The learner's answer is already confirmed correct by the local engine. You MUST set 'isCorrect' to true. Set 'feedbackDetails' to null and 'error' to null. Always provide exactly one 'naturalAnswer' in the target language and brief encouraging Vietnamese 'feedbackVi'."
      : "",
    "If the learner's answer is correct/accurate:",
    "  - Set 'isCorrect' to true.",
    "  - Set 'feedbackDetails' to null and 'error' to null. Do not generate detailed error or feedback objects to save tokens.",
    "  - Provide exactly one concise 'naturalAnswer' in the expected target language.",
    "If the learner's answer is wrong or inaccurate:",
    "  - Set 'isCorrect' to false.",
    "  - Provide exactly one concise 'naturalAnswer' in the expected target language.",
    "  - If they fell into a literal/word-by-word translation trap, specify it briefly in 'literalTranslationTrap'.",
    "  - Populate feedbackDetails with: whatWasWrong (max 200 chars), whyItWasWrong (max 300 chars), correctUnderstanding (max 300 chars), mistakeType (max 100 chars), nextPracticeItem (max 200 chars or null), detailedExplanation (max 400 chars).",
    "  - Populate the 'error' object only for a real misunderstanding worth saving. Set shouldSave and confidence (0-100). Keep explanationVi max 300 chars and targetItem max 150 chars.",
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
