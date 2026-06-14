export const reviewPromptJsonShape = {
  reviewPromptEn: "new English practice sentence containing the concept",
  reviewPromptVi:
    "Vietnamese prompt asking the learner to translate, e.g. 'Dịch câu sau sang tiếng Việt tự nhiên...'",
  reviewRubricVi:
    "Vietnamese grading rubric containing key context details and translation traps to check",
  reviewCorrectAnswer: "canonical correct natural Vietnamese translation",
  reviewAcceptableAnswers: [
    "alternative correct Vietnamese translation 1",
    "alternative correct Vietnamese translation 2",
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
    "1. Generate a NEW, privacy-safe, realistic English sentence (`reviewPromptEn`) that uses the concept phrase naturally. Do not reuse any project names, private details, or sensitive context.",
    "   * CRITICAL: `reviewPromptEn` MUST be a complete, grammatically correct full sentence (typically 8 to 20 words). It MUST NOT be just the concept phrase itself or a fragment.",
    "2. The sentence must test the same understanding that the learner failed (e.g. if category is phrasal_verb, ensure the verb has the correct phrasal sense in the new sentence).",
    "3. The sentence should be appropriate for business or general English context, depending on the category.",
    "4. Generate a Vietnamese translation prompt (`reviewPromptVi`), e.g. 'Dịch câu sau sang tiếng Việt tự nhiên: ...'",
    "5. Provide a clear, natural Vietnamese correct translation (`reviewCorrectAnswer`) and 1-3 alternative translations (`reviewAcceptableAnswers`).",
    "   * CRITICAL: These answers MUST be full natural translations of the entire generated sentence (`reviewPromptEn`). They MUST NOT be just the translation of the concept phrase alone.",
    "6. Provide a short Vietnamese grading rubric (`reviewRubricVi`) highlighting what key meaning components the translation must preserve and what word-by-word traps to penalize.",
    "7. Return strict JSON only. No markdown.",
    "JSON shape:",
    JSON.stringify(reviewPromptJsonShape),
  ].join("\n\n");
}
