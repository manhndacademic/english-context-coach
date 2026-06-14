import { MAX_LESSON_ITEMS } from "@/domain/constants";

export const analysisJsonShape = {
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
    "For every key phrase, generate exactly 3 context-relevant example sentences in the `examples` array. Each example must have `exampleEn` (the English sentence using the phrase) and `exampleVi` (its natural Vietnamese translation). These examples must be related to the source context but should not expose private names, project identifiers, URLs, or sensitive snippets.",
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
