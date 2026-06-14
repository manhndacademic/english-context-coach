import {
  MAX_LESSON_ITEMS,
  MIN_LESSON_ITEMS,
  PROMPT_VERSIONS,
} from "@/domain/constants";
import type { AnalysisResult } from "./schemas";

const analysisJsonShape = {
  title: "short neutral Vietnamese/English title",
  textType:
    "work_message | technical_doc | email | article | academic | general | unknown",
  inputMode:
    "understand_and_practice | fix_and_understand | naturalize_english | mixed_language_support | not_english | developer_error_explanation | unsupported",
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
      explanationVi:
        "Vietnamese explanation of what to notice in the whole source text",
      difficulty: "A2 | B1 | B2 | C1",
    },
  ],
  sentenceBreakdowns: [
    {
      sentence: "source sentence or coherent sentence fragment",
      correctedSentenceEn:
        "optional string: corrected English version of this sentence (only for fix_and_understand or naturalize_english modes)",
      naturalMeaningVi: "natural Vietnamese meaning of this sentence",
      structureNotesVi:
        "Vietnamese explanation of grammar, reference, or structure that affects understanding",
      toneOrContextVi: "optional Vietnamese note about tone or context",
    },
  ],
  keyPhrases: [
    {
      phrase: "string",
      conceptKey: "snake_case identifier for the concept (e.g. push_back)",
      conceptPhrase:
        "generalized canonical English phrase of the concept (e.g. push back)",
      conceptMeaningVi:
        "generalized Vietnamese meaning of the concept (e.g. dời lại / trì hoãn)",
      meaningVi: "string",
      meaningInContextVi: "string",
      exampleEn:
        "related English example sentence using the phrase (corresponds to the first item in examples)",
      exampleVi:
        "natural Vietnamese meaning of the example (corresponds to the first item in examples)",
      examples: [
        {
          exampleEn: "related English example sentence 1 using the phrase",
          exampleVi: "natural Vietnamese translation of example 1",
        },
        {
          exampleEn: "related English example sentence 2 using the phrase",
          exampleVi: "natural Vietnamese translation of example 2",
        },
        {
          exampleEn: "related English example sentence 3 using the phrase",
          exampleVi: "natural Vietnamese translation of example 3",
        },
      ],
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

const gradingJsonShape = {
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

const reviewPromptJsonShape = {
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

export const repairJsonShapes = {
  analysis: analysisJsonShape,
  exercises: exercisesJsonShape,
  grading: gradingJsonShape,
} as const;

export function analysisPrompt(sourceText: string, userHighlights?: string[]) {
  const list = [
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
    "For every key phrase, generate exactly 3 context-relevant example sentences in the `examples` array. Each example must have `exampleEn` (the English sentence using the phrase) and `exampleVi` (its natural Vietnamese translation). These examples must be related to the source context but should not expose private names, project identifiers, URLs, or sensitive snippets. For backward compatibility, also populate the root `exampleEn` and `exampleVi` fields of the key phrase using the first item in the `examples` list.",
    "Do not include a full literal translation of the whole source text; only include literalTranslationVi for a key phrase when it is a real trap.",
    "Keep meaningInContextVi concise, and include whyConfusingVi only when there is a real learner trap.",
    "Use natural learner-friendly Vietnamese.",
    "When referencing English key phrases, grammatical structures, or technical terms within Vietnamese descriptions (such as structureNotesVi, whyConfusingVi, contextExplanationVi, or explanationVi), format them using markdown backticks (e.g., `concerned with` or `Rooted in`). Use standard markdown (**bold**, *italic*) for other inline emphasis. Avoid using raw single quotes ('...') for these items.",
    "For technical/workplace terms, keep English when that is natural in Vietnamese, then explain it.",
    "The title must be neutral and must avoid names, company names, project identifiers, URLs, and sensitive snippets.",
    "JSON shape:",
    JSON.stringify(analysisJsonShape),
    `Source text:\n${sourceText}`,
  ];

  if (userHighlights && userHighlights.length > 0) {
    list.push(
      `CRITICAL REQUIREMENT: The user has explicitly highlighted the following phrases from the text that they want to learn. You MUST include each of these highlighted phrases in the 'keyPhrases' array of the output, explaining their category, difficulty, contextual meaning, and literal/natural translations: ${JSON.stringify(userHighlights)}.\n` +
        `You MUST include them even if they are single, common, or simple words. This overrides any rules about ignoring simple or single words.\n` +
        `IMPORTANT: In addition to these user-highlighted phrases, you should still identify and generate other key phrases from the remaining text as normal, up to the maximum limit of ${MAX_LESSON_ITEMS} total key phrases. Do not restrict your analysis to only the user-highlighted phrases.`
    );
  }

  return list.join("\n\n");
}

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

export function repairPrompt(rawJson: string, schemaName: string) {
  const expectedShape =
    repairJsonShapes[schemaName as keyof typeof repairJsonShapes];
  return [
    `Repair this ${schemaName} response into valid strict JSON only.`,
    "The top-level JSON value must be an object, not an array.",
    expectedShape
      ? `Expected JSON shape:\n${JSON.stringify(expectedShape)}`
      : undefined,
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
