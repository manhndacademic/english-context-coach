import { MAX_LESSON_ITEMS, MIN_LESSON_ITEMS, PROMPT_VERSIONS } from "@/domain/constants";
import type { AnalysisResult } from "./schemas";

const analysisJsonShape = {
  title: "short neutral Vietnamese/English title",
  textType: "work_message | technical_doc | email | article | academic | general | unknown",
  detectedLevel: "A2 | B1 | B2 | C1",
  summaryVi: "string",
  naturalTranslationVi: "string",
  contextExplanationVi: "string",
  lessonFocuses: [
    {
      title: "short learner-facing focus title",
      category: "tone | structure | purpose | context",
      explanationVi: "Vietnamese explanation of what to notice in the whole source text",
      difficulty: "A2 | B1 | B2 | C1",
    },
  ],
  keyPhrases: [
    {
      phrase: "string",
      meaningVi: "string",
      meaningInContextVi: "string",
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
  feedbackVi: "Vietnamese learner-friendly feedback",
  errorType:
    "optional: literal_translation | phrase_misunderstanding | technical_term_misunderstanding | phrasal_verb_error | collocation_error | grammar_structure_misread | pronoun_reference_misread | tone_register_misread | missing_context",
  explanationVi: "optional Vietnamese explanation of the error",
};

const repairJsonShapes = {
  analysis: analysisJsonShape,
  exercises: exercisesJsonShape,
  grading: gradingJsonShape,
} as const;

export function analysisPrompt(sourceText: string) {
  return [
    "You are English Context Coach for Vietnamese learners.",
    "Analyze the English source text in context. Do not translate word by word.",
    "Return strict JSON only. No markdown.",
    `Generate 1-${MAX_LESSON_ITEMS} distinct key phrases. Short source texts may have only 1-2 key phrases; do not add filler.`,
    "Generate 1-3 lessonFocuses for whole-text tone, structure, purpose, or context.",
    "Choose key phrases that are useful as learner-facing list rows, including single words only when their contextual sense matters.",
    "Prefer key phrases that appear directly in the source text so the UI can highlight them.",
    "Do not include duplicate or overlapping key phrases when they teach the same thing; keep the phrase that best matches the source text.",
    "Keep meaningVi as reusable general meaning and meaningInContextVi as the specific meaning in this source text.",
    "Do not include a full literal translation of the whole source text; only include literalTranslationVi for a key phrase when it is a real trap.",
    "Keep meaningInContextVi concise, and include whyConfusingVi only when there is a real learner trap.",
    "Use natural learner-friendly Vietnamese.",
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

export const promptVersions = PROMPT_VERSIONS;
