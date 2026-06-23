import type { Prompt } from "@/domain/ai";
import {
  gradingSchema,
  reviewPromptSchema,
  type GradingResult,
  type ReviewPromptResult,
} from "./schemas";

const PROMPT_VERSIONS = {
  grading: "grading-v2",
  review_prompt: "review_prompt-v1",
} as const;

const SCHEMA_VERSIONS = {
  grading: "grading-schema-v1",
  review_prompt: "review_prompt-schema-v1",
} as const;

const gradingJsonShape = {
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

const reviewPromptJsonShape = {
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

export class GradingPrompt implements Prompt<GradingResult> {
  public readonly purpose = "grading";
  public readonly promptVersion = PROMPT_VERSIONS.grading;
  public readonly schemaVersion = SCHEMA_VERSIONS.grading;
  public readonly schema = gradingSchema;
  public readonly modelKind = "analysis";
  public readonly expectedShape = gradingJsonShape;

  constructor(
    private readonly input: {
      promptEn: string;
      promptVi: string;
      answer: string;
      rubricVi?: string | null;
      correctAnswer?: string | null;
      forceCorrect?: boolean;
    }
  ) {}

  render(): string {
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
      this.input.forceCorrect
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
      `Prompt VI: ${this.input.promptVi}`,
      `Prompt EN: ${this.input.promptEn}`,
      `Rubric VI: ${this.input.rubricVi ?? ""}`,
      this.input.correctAnswer
        ? `Correct/Expected Answer: ${this.input.correctAnswer}`
        : "",
      `Learner answer: ${this.input.answer}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }
}

export class ReviewPromptGenerationPrompt implements Prompt<ReviewPromptResult> {
  public readonly purpose = "exercise_generation";
  public readonly promptVersion = PROMPT_VERSIONS.review_prompt;
  public readonly schemaVersion = SCHEMA_VERSIONS.review_prompt;
  public readonly schema = reviewPromptSchema;
  public readonly modelKind = "fast";
  public readonly expectedShape = reviewPromptJsonShape;

  constructor(
    private readonly input: {
      conceptPhrase: string;
      conceptMeaningVi: string;
      category: string;
      errorType: string;
    }
  ) {}

  render(): string {
    return [
      "You are English Context Coach for Vietnamese learners.",
      "Create a new context review practice exercise for a learner who previously misunderstood this concept.",
      "Concept English phrase: " + this.input.conceptPhrase,
      "Concept Vietnamese meaning: " + this.input.conceptMeaningVi,
      "Concept category: " + this.input.category,
      "Previous error type: " + this.input.errorType,
      "Instructions:",
      "1. Dynamically select the best review exercise type (`reviewType`) based on the concept and the previous error, while actively aiming to diversify the exercise types. Avoid overusing `natural_translation` for every general phrase; instead, challenge the learner with varied formats to build deeper mastery:",
      "   - Use `cloze_phrase` or `dialogue_completion` to check active recall and context use of phrasal verbs, collocations, or common vocabulary.",
      "   - Use `trap_choice` or `trap_detect` to help the learner identify and dodge literal/word-by-word translation traps.",
      "   - Use `natural_translation` primarily to assess natural Vietnamese phrasing of full sentences, but do not make it the default for everything.",
      "2. Generate a NEW, privacy-safe, realistic English sentence (`reviewPromptEn`) that uses the concept phrase naturally. Do not reuse any project names, private details, or sensitive context.",
      '   - For `cloze_phrase`, replace the concept phrase in `reviewPromptEn` with a blank: e.g. "Can we ____ the meeting back?" for "push back".',
      '   - For `dialogue_completion`, format the conversation with a newline separating A and B (e.g., "A: ...\nB: [Write your reply using ...]"), and replace the concept phrase with a blank or placeholder.',
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
}
