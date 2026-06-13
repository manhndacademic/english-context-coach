import { MAX_LESSON_ITEMS, MIN_LESSON_ITEMS, PROMPT_VERSIONS } from "@/domain/constants";
import type { AnalysisResult } from "./schemas";

const analysisJsonShape = {
  title: "short neutral Vietnamese/English title",
  textType: "work_message | technical_doc | email | article | academic | general | unknown",
  inputMode: "understand_and_practice | fix_and_understand | naturalize_english | mixed_language_support | not_english | developer_error_explanation | unsupported",
  detectedLevel: "A2 | B1 | B2 | C1",
  summaryVi: "string",
  naturalTranslationVi: "string",
  contextExplanationVi: "string",
  lessonFocuses: [
    {
      title: "short learner-facing focus title",
      conceptKey: "snake_case identifier for the concept (e.g. polite_request)",
      conceptPhrase: "generalized canonical title/phrase of the concept",
      conceptMeaningVi: "generalized Vietnamese explanation of the concept",
      category: "tone | structure | purpose | context",
      explanationVi: "Vietnamese explanation of what to notice in the whole source text",
      difficulty: "A2 | B1 | B2 | C1",
    },
  ],
  sentenceBreakdowns: [
    {
      sentence: "source sentence or coherent sentence fragment",
      correctedSentenceEn: "optional string: corrected English version of this sentence (only for fix_and_understand or naturalize_english modes)",
      naturalMeaningVi: "natural Vietnamese meaning of this sentence",
      structureNotesVi: "Vietnamese explanation of grammar, reference, or structure that affects understanding",
      toneOrContextVi: "optional Vietnamese note about tone or context",
    },
  ],
  keyPhrases: [
    {
      phrase: "string",
      conceptKey: "snake_case identifier for the concept (e.g. push_back)",
      conceptPhrase: "generalized canonical English phrase of the concept (e.g. push back)",
      conceptMeaningVi: "generalized Vietnamese meaning of the concept (e.g. dời lại / trì hoãn)",
      meaningVi: "string",
      meaningInContextVi: "string",
      exampleEn: "related English example sentence using the phrase",
      exampleVi: "natural Vietnamese meaning of the example",
      literalTranslationVi: "optional string",
      naturalTranslationVi: "optional string",
      whyConfusingVi: "optional string",
      category:
        "idiom | phrasal_verb | technical_term | collocation | grammar_pattern | business_phrase | general_phrase",
      difficulty: "A2 | B1 | B2 | C1",
    },
  ],
};

const exercisesJsonShape = {
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
      promptVi: "Vietnamese prompt asking the learner to translate English into natural Vietnamese",
      promptEn: "English sentence to translate into Vietnamese",
      rubricVi: "Vietnamese grading rubric",
    },
    {
      type: "focus_question",
      focus: "lesson focus title",
      promptVi: "Vietnamese open-ended prompt about whole-text meaning, tone, structure, or purpose",
      promptEn: "optional English source sentence or excerpt",
      rubricVi: "Vietnamese grading rubric",
    },
  ],
};

const gradingJsonShape = {
  score: "integer 0-100",
  isCorrect: "boolean",
  feedbackVi: "concise, actionable Vietnamese learner-friendly feedback",
  naturalAnswer: "optional natural translation/answer in Vietnamese, showing the correct/natural way to translate/understand in context",
  literalTranslationTrap: "optional literal/word-by-word Vietnamese translation trap if the user fell into it (e.g. 'lấy một cái nhìn' for 'take a look')",
  error: {
    shouldSave: "boolean: true if this is a high-value structured error that should be saved to the learner's error memory for later review (e.g., a real misunderstanding of a phrasal verb, collocation, literal trap, context or tone, etc. - false if it is just a minor typo, layout/formatting issue, or random noise)",
    confidence: "integer 0-100: AI confidence score that this structured error is correct and worth saving",
    errorType: "literal_translation | phrase_misunderstanding | technical_term_misunderstanding | phrasal_verb_error | collocation_error | grammar_structure_misread | pronoun_reference_misread | tone_register_misread | missing_context",
    explanationVi: "concise Vietnamese explanation of the error",
    targetItem: "the specific English key phrase or structure that was misunderstood/translated incorrectly (e.g., 'take a look')"
  }
};

const reviewPromptJsonShape = {
  reviewPromptEn: "new English practice sentence containing the concept",
  reviewPromptVi: "Vietnamese prompt asking the learner to translate, e.g. 'Dịch câu sau sang tiếng Việt tự nhiên...'",
  reviewRubricVi: "Vietnamese grading rubric containing key context details and translation traps to check",
  reviewCorrectAnswer: "canonical correct natural Vietnamese translation",
  reviewAcceptableAnswers: ["alternative correct Vietnamese translation 1", "alternative correct Vietnamese translation 2"],
};

export const repairJsonShapes = {
  analysis: analysisJsonShape,
  exercises: exercisesJsonShape,
  grading: gradingJsonShape,
} as const;

export function analysisPrompt(sourceText: string) {
  return [
    "You are English Context Coach for Vietnamese learners.",
    "Analyze the English source text in context. Do not translate word by word.",
    "First, classify the source text into one of these 'inputMode' categories:",
    "  - `understand_and_practice`: Standard, grammatically correct English text.",
    "  - `fix_and_understand`: Grammatically incorrect English (e.g. Vietlish: 'Yesterday I go to office').",
    "  - `naturalize_english`: Grammatically correct but awkward/unnatural English ('I very like this').",
    "  - `mixed_language_support`: Mixed English and Vietnamese ('Anh check hộ em this ticket').",
    "  - `not_english`: Primarily non-English text (French, purely Vietnamese, etc.).",
    "  - `developer_error_explanation`: Developer error traceback logs (TypeError, SyntaxError, etc.).",
    "  - `unsupported`: Gibberish, too short, or meaningless input.",
    "Adapt your output fields dynamically based on the detected inputMode:",
    "  - For `not_english` / `unsupported`: Set `summaryVi` to a friendly warning/explanation in Vietnamese. Set `keyPhrases`, `lessonFocuses`, and `sentenceBreakdowns` to empty arrays (`[]`). Set `naturalTranslationVi` and `contextExplanationVi` to 'none'.",
    "  - For `fix_and_understand` / `naturalize_english`: Show grammar corrections and explain why the original was wrong or awkward in `summaryVi`. In `sentenceBreakdowns`, compare the original sentences directly with the corrected English versions. Let `naturalTranslationVi` translate the corrected English.",
    "  - For `developer_error_explanation`: Explain the developer error stack trace clearly in Vietnamese in `summaryVi` and common causes/resolutions in `contextExplanationVi`.",
    "Return strict JSON only. No markdown.",
    `Generate 1-${MAX_LESSON_ITEMS} distinct key phrases. Short source texts may have only 1-2 key phrases; do not add filler.`,
    "For each keyPhrase and lessonFocus, you MUST identify its underlying general concept. Generate:",
    "  - `conceptKey`: A snake_case identifier that groups this phrase or focus semantically (e.g., `push_back` for 'push this back' or 'push the meeting back').",
    "  - `conceptPhrase`: The generalized canonical form in English (e.g., `push back` for 'push this back').",
    "  - `conceptMeaningVi`: The generalized Vietnamese meaning (e.g., `dời lại / trì hoãn`).",
    "Generate sentenceBreakdowns for the important source sentences. Keep each breakdown useful for reading comprehension, not a grammar dump.",
    "Generate 1-3 lessonFocuses for whole-text tone, structure, purpose, or context.",
    "Choose key phrases that are useful as learner-facing list rows, including single words only when their contextual sense matters.",
    "Prefer key phrases that appear directly in the source text so the UI can highlight them.",
    "Do not include duplicate or overlapping key phrases when they teach the same thing; keep the phrase that best matches the source text.",
    "Keep meaningVi as reusable general meaning and meaningInContextVi as the specific meaning in this source text.",
    "For every key phrase, include exampleEn and exampleVi. The example must be related to the source context but should not expose private names, project identifiers, URLs, or sensitive snippets.",
    "Do not include a full literal translation of the whole source text; only include literalTranslationVi for a key phrase when it is a real trap.",
    "Keep meaningInContextVi concise, and include whyConfusingVi only when there is a real learner trap.",
    "Use natural learner-friendly Vietnamese.",
    "When referencing English key phrases, grammatical structures, or technical terms within Vietnamese descriptions (such as structureNotesVi, whyConfusingVi, contextExplanationVi, or explanationVi), format them using markdown backticks (e.g., `concerned with` or `Rooted in`). Use standard markdown (**bold**, *italic*) for other inline emphasis. Avoid using raw single quotes ('...') for these items.",
    "For technical/workplace terms, keep English when that is natural in Vietnamese, then explain it.",
    "The title must be neutral and must avoid names, company names, project identifiers, URLs, and sensitive snippets.",
    "JSON shape:",
    JSON.stringify(analysisJsonShape),
    `Source text:\n${sourceText}`,
  ].join("\n\n");
}

export function exercisesPrompt(analysis: AnalysisResult) {
  return [
    "Create practice exercises for Vietnamese learners from these validated key phrases and lesson focuses.",
    "Return strict JSON only. No markdown.",
    `Generate ${MIN_LESSON_ITEMS}-${MAX_LESSON_ITEMS} exercises total.`,
    "Allowed types: meaning_choice, cloze_phrase, natural_translation, focus_question.",
    "Include at least one focus_question that targets a lessonFocus.",
    "Include at least one key-phrase exercise when keyPhrases are present.",
    "Natural translation exercises must ask the learner to translate English into natural Vietnamese, never Vietnamese into English.",
    "Natural translation and focus_question exercises should judge contextual meaning, not literal word coverage.",
    "focus_question must be open-ended, grounded in the source text, and test whole-text tone, structure, purpose, or context.",
    "When writing exercise prompts (promptVi, promptEn) or choices, wrap English phrases or terms under discussion in markdown backticks (e.g., `unlike` or `however`). Avoid wrapping them in raw single quotes ('...').",
    "JSON shape:",
    JSON.stringify(exercisesJsonShape),
    "Validated analysis:",
    JSON.stringify(analysis),
  ].join("\n\n");
}

export function gradingPrompt(input: {
  promptEn: string;
  promptVi: string;
  answer: string;
  rubricVi?: string | null;
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
    "  - Populate the 'error' object with structured details for memory if it is a real misunderstanding (not a minor spelling typo). Set 'shouldSave' to true and 'confidence' to your confidence score (0-100). Keep the Vietnamese feedback and error explanation concise.",
    "Return strict JSON only. No markdown.",
    "JSON shape:",
    JSON.stringify(gradingJsonShape),
    `Prompt VI: ${input.promptVi}`,
    `Prompt EN: ${input.promptEn}`,
    `Rubric VI: ${input.rubricVi ?? ""}`,
    `Learner answer: ${input.answer}`,
  ].join("\n\n");
}

export function repairPrompt(rawJson: string, schemaName: string) {
  const expectedShape = repairJsonShapes[schemaName as keyof typeof repairJsonShapes];
  return [
    `Repair this ${schemaName} response into valid strict JSON only.`,
    "The top-level JSON value must be an object, not an array.",
    expectedShape ? `Expected JSON shape:\n${JSON.stringify(expectedShape)}` : undefined,
    "Keep the same meaning. Do not add markdown.",
    rawJson,
  ]
    .filter(Boolean)
    .join("\n\n");
}

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

export const promptVersions = PROMPT_VERSIONS;
