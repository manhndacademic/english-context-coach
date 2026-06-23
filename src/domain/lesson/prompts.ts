import type { Prompt } from "@/domain/ai";
import { MAX_LESSON_ITEMS } from "@/domain/constants";
import {
  analysisSchema,
  exercisesSchema,
  diffAnalysisSchema,
  writingCoachAnalysisSchema,
  type AnalysisResult,
  type ExercisesResult,
  type DiffAnalysisResult,
  type WritingCoachAnalysisResult,
} from "./schemas";
import type { SaveAnalysisInput } from "./ports";

const PROMPT_VERSIONS = {
  analysis: "analysis-v3",
  exercises: "exercises-v1",
  diffAnalysis: "diff-analysis-v1",
  writingCoach: "writing-coach-v1",
} as const;

const SCHEMA_VERSIONS = {
  analysis: "analysis-schema-v1",
  exercises: "exercises-schema-v1",
  diffAnalysis: "diff-analysis-schema-v1",
  writingCoach: "writing-coach-schema-v1",
} as const;

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
      diffSpans:
        "optional array: character-level diff between sentence and correctedSentenceEn. Each item: {type: 'equal'|'delete'|'insert', text: string}. Only for fix_and_understand or naturalize_english. Omit if no correction.",
      naturalMeaningVi: "natural Vietnamese meaning of this sentence",
      structureNotesVi:
        "Vietnamese explanation of grammar, reference, or structure that affects understanding",
      toneOrContextVi: "optional Vietnamese note about tone or context",
      ipa: "optional string: US English IPA phonetic representation of the corrected/correct version of the sentence (without slashes or brackets, e.g. aɪ wɛnt tu ðə ˈɔːfɪs ˈjɛstədeɪ)",
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
          ipa: "optional string: US English IPA phonetic representation of the example sentence (without slashes or brackets)",
        },
        {
          exampleEn: "related English example sentence 2 using the phrase",
          exampleVi: "natural Vietnamese translation of example 2",
          ipa: "optional string: US English IPA phonetic representation of the example sentence (without slashes or brackets)",
        },
        {
          exampleEn: "related English example sentence 3 using the phrase",
          exampleVi: "natural Vietnamese translation of example 3",
          ipa: "optional string: US English IPA phonetic representation of the example sentence (without slashes or brackets)",
        },
      ],
      literalTranslationVi: "optional string",
      naturalTranslationVi: "optional string",
      whyConfusingVi: "optional string",
      ipa: "optional string: US English IPA phonetic representation of the key phrase (without slashes or brackets, e.g. pʊʃ bæk)",
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

export class AnalysisPrompt implements Prompt<AnalysisResult> {
  public readonly purpose = "analysis";
  public readonly promptVersion = PROMPT_VERSIONS.analysis;
  public readonly schemaVersion = SCHEMA_VERSIONS.analysis;
  public readonly schema = analysisSchema;
  public readonly modelKind = "analysis";
  public readonly expectedShape = analysisJsonShape;

  constructor(
    private readonly sourceText: string,
    private readonly userHighlights?: string[],
    private readonly requestedMode?: string
  ) {}

  render(): string {
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
      '  - For `fix_and_understand` / `naturalize_english`: Show grammar corrections and explain why the original was wrong or awkward in `summaryVi`. In `sentenceBreakdowns`, you MUST split the entire source text into individual sentences and generate a breakdown for EVERY sentence in its original order (do not skip any sentence, even if it has no errors). Let `naturalTranslationVi` translate the corrected English. For each corrected sentence, include a `diffSpans` array showing the character-level difference between `sentence` and `correctedSentenceEn`. Each span has `type` (\'equal\', \'delete\', or \'insert\') and `text`. Example: sentence=\'I want go home\', correctedSentenceEn=\'I want to go home\', diffSpans=[{"type":"equal","text":"I want "},{"type":"insert","text":"to "},{"type":"equal","text":"go home"}]. If the sentence has no error and equals correctedSentenceEn, set `correctedSentenceEn` to the same as `sentence`, and emit diffSpans=[{"type":"equal","text":"<the full sentence>"}] or omit diffSpans entirely. Keep `structureNotesVi` brief (e.g., "Câu này viết đúng ngữ pháp và tự nhiên.") for error-free sentences.',
      "  - For `developer_error_explanation`: Explain the developer error stack trace clearly in Vietnamese in `summaryVi` and common causes/resolutions in `contextExplanationVi`.",
      "Return strict JSON only. No markdown.",
      `Generate 1-${MAX_LESSON_ITEMS} distinct key phrases. Short source texts may have only 1-2 key phrases; do not add filler.`,
      "For each keyPhrase and lessonFocus, you MUST identify its underlying general concept. Generate:",
      "  - `conceptKey`: A snake_case identifier that groups this phrase or focus semantically (e.g., `push_back` for 'push this back' or 'push the meeting back').",
      "  - `conceptPhrase`: The generalized canonical form in English (e.g., `push back` for 'push this back').",
      "  - `conceptMeaningVi`: The generalized Vietnamese meaning (e.g., `dời lại / trì hoãn`).",
      "For standard `understand_and_practice` and other modes, generate `sentenceBreakdowns` for the important source sentences. For `fix_and_understand` / `naturalize_english` modes, you MUST generate `sentenceBreakdowns` for ALL sentences of the source text in sequence.",
      "Generate 1-3 lessonFocuses for whole-text tone, structure, purpose, or context.",
      "Choose key phrases that are useful as learner-facing list rows, including single words only when their contextual sense matters.",
      "Prefer key phrases that appear directly in the source text so the UI can highlight them.",
      "Do not include duplicate or overlapping key phrases when they teach the same thing; keep the phrase that best matches the source text.",
      "Keep meaningVi as reusable general meaning and meaningInContextVi as the specific meaning in this source text.",
      "For every key phrase, generate exactly 3 context-relevant example sentences in the `examples` array. Each example must have `exampleEn` (the English sentence using the phrase), `exampleVi` (its natural Vietnamese translation), and `ipa` (its US English IPA phonetic representation). These examples must be related to the source context but should not expose private names, project identifiers, URLs, or sensitive snippets.",
      "Do not include a full literal translation of the whole source text; only include literalTranslationVi for a key phrase when it is a real trap.",
      "Keep meaningInContextVi concise, and include whyConfusingVi only when there is a real learner trap.",
      "CRITICAL: For every keyPhrase (the phrase itself), example sentence in examples, and sentence in sentenceBreakdowns (the corrected or correct version), you MUST generate the standard International Phonetic Alphabet (IPA) representation following US English (General American) pronunciation standards. Store the IPA representation inside the 'ipa' field of each object strictly without wrapping it in forward slashes or square brackets.",
      "Use natural learner-friendly Vietnamese.",
      "When referencing English key phrases, grammatical structures, or technical terms within Vietnamese descriptions (such as structureNotesVi, whyConfusingVi, contextExplanationVi, or explanationVi), format them using markdown backticks (e.g., `concerned with` or `Rooted in`). Use standard markdown (**bold**, *italic*) for other inline emphasis. Avoid using raw single quotes ('...') for these items.",
      "CRITICAL: Do NOT wrap key phrases, vocabulary words, or any words in single quotes ('...') or backticks (`...`) inside generated English or Vietnamese sentences (such as examples in `examples` or corrected sentences in `correctedSentenceEn`). The sentences must look natural as they would appear in regular written text.",
      "For technical/workplace terms, keep English when that is natural in Vietnamese, then explain it.",
      "The title must be neutral and must avoid names, company names, project identifiers, URLs, and sensitive snippets.",
      "JSON shape:",
      JSON.stringify(analysisJsonShape),
      `Source text:\n${this.sourceText}`,
    ];

    if (this.requestedMode && this.requestedMode !== "auto") {
      list.push(
        `CRITICAL: The user has requested to process this text in mode: \`${this.requestedMode}\`. You MUST classify the inputMode as \`${this.requestedMode}\` and adapt the content fields accordingly.`
      );
    }

    if (this.userHighlights && this.userHighlights.length > 0) {
      list.push(
        `CRITICAL REQUIREMENT: The user has explicitly highlighted the following phrases from the text that they want to learn. You MUST include each of these highlighted phrases in the 'keyPhrases' array of the output, explaining their category, difficulty, contextual meaning, and literal/natural translations: ${JSON.stringify(this.userHighlights)}.\n` +
          `You MUST include them even if they are single, common, or simple words. This overrides any rules about ignoring simple or single words.\n` +
          `IMPORTANT: In addition to these user-highlighted phrases, you should still identify and generate other key phrases from the remaining text as normal, up to the maximum limit of ${MAX_LESSON_ITEMS} total key phrases. Do not restrict your analysis to only the user-highlighted phrases.`
      );
    }

    return list.join("\n\n");
  }
}

export class ExercisesPrompt implements Prompt<ExercisesResult> {
  public readonly purpose = "exercise_generation";
  public readonly promptVersion = PROMPT_VERSIONS.exercises;
  public readonly schemaVersion = SCHEMA_VERSIONS.exercises;
  public readonly schema = exercisesSchema;
  public readonly modelKind = "fast";
  public readonly expectedShape = exercisesJsonShape;

  constructor(
    private readonly analysis: AnalysisResult,
    private readonly activeMistakePatterns?: Array<{
      conceptKey: string;
      category: string;
    }>
  ) {}

  render(): string {
    const phraseCount = this.analysis.keyPhrases?.length ?? 0;
    const focusCount = this.analysis.lessonFocuses?.length ?? 0;
    const totalConcepts = phraseCount + focusCount;

    let minCount = 5;
    let maxCount = 10;

    if (totalConcepts <= 1) {
      minCount = 2;
      maxCount = 3;
    } else if (totalConcepts <= 3) {
      minCount = 4;
      maxCount = 5;
    } else if (totalConcepts <= 5) {
      minCount = 6;
      maxCount = 8;
    }

    const promptSections = [
      `Create ${minCount}-${maxCount} practice exercises for Vietnamese learners using the validated key phrases and lesson focuses. You MUST include at least one exercise of type 'focus_question'. Strict JSON only.`,
      `Exercise types:
- meaning_choice: Multiple-choice on phrase meaning. Requires "choices" array (3-4 items). Graded locally.
- cloze_phrase: Fill in the blank. "promptEn" must contain "____" (4 underscores) for the missing phrase. Graded locally.
- natural_translation: Translate English sentence into natural Vietnamese. No choices. AI-graded.
- focus_question: Open-ended question about text meaning/tone/structure. Targets a lessonFocus. No choices. AI-graded.
- trap_choice: Choose natural translation avoiding literal traps. "choices" array must have 1 natural (correct) + 2-3 literal traps (wrong). Graded locally.
- phrase_production: Write English sentence containing key phrase. No choices. AI-graded.
- dialogue_completion: Complete B's response in A/B dialogue using key phrase. "promptEn" must show the dialogue with B's placeholder. ALWAYS separate speakers with a newline (e.g., "A: ...\nB: [Write your reply using 'X']"). No choices. AI-graded.
- register_shift: Rewrite dry/awkward English sentence using key phrase naturally. No choices. AI-graded.
- trap_detect: Identify/explain translation trap. Requires "choices" array (3-4 items) for explanation. Graded locally.`,
      `Wording constraints for promptVi:
- cloze_phrase: "Điền từ/cụm từ phù hợp vào chỗ trống."
- meaning_choice: "Cụm \`X\` trong câu trên có nghĩa gần nhất với?"
- trap_choice: "Chọn bản dịch tự nhiên nhất, tránh dịch từng từ."
- phrase_production: "Viết một câu tiếng Anh sử dụng cụm \`X\` để diễn đạt ý: ..."
- dialogue_completion: "Viết câu trả lời của B bằng tiếng Anh, sử dụng cụm \`X\`."
- register_shift: "Viết lại câu dưới đây tự nhiên hơn bằng cách sử dụng cụm \`X\`."
- natural_translation: "Dịch câu sau sang tiếng Việt tự nhiên."
- Do not reveal the answer or hint at the correct response in promptVi.`,
      "CRITICAL REQUIREMENT: You MUST include at least one exercise of type 'focus_question' in the 'exercises' array. This exercise must target one of the lessonFocuses provided in the analysis data. Ensure every key phrase has 1-2 associated exercises (mix passive and active types).",
      "Wrap English phrases/terms in markdown backticks (e.g. `unlike`) ONLY when referencing them inside Vietnamese prompts or instructions (promptVi). Do NOT wrap key phrases, vocabulary words, or any words in single quotes ('...') or backticks (`...`) inside generated English sentences (promptEn), dialogue texts, correct answers, or acceptable answers.",
      "JSON shape:",
      JSON.stringify(exercisesJsonShape),
      "Analysis data:",
      JSON.stringify(this.analysis),
    ];

    if (this.activeMistakePatterns && this.activeMistakePatterns.length > 0) {
      const patternsSummary = this.activeMistakePatterns
        .map((p) => `- Concept: "${p.conceptKey}", Category: "${p.category}"`)
        .join("\n");
      promptSections.push(
        `CRITICAL PERSONALIZATION REQUIREMENT:\n` +
          `The learner frequently makes mistakes in the following concepts or categories:\n${patternsSummary}\n` +
          `If any key phrase or lesson focus in this lesson matches these concepts or categories, you MUST prioritize creating challenging or trap-avoiding exercises for them (such as 'phrase_production', 'trap_choice', or 'trap_detect') to help the learner overcome their weaknesses.`
      );
    }

    return promptSections.join("\n\n");
  }
}

const diffAnalysisJsonShape = {
  title:
    "short neutral Vietnamese/English title describing the core correction",
  textType:
    "work_message | technical_doc | email | article | academic | general | unknown",
  detectedLevel: "A2 | B1 | B2 | C1",
  corrections: [
    {
      draftPhrase: "the wrong/awkward phrase from the draft text",
      correctedPhrase: "the correct/natural phrase from the corrected text",
      explanationVi:
        "Vietnamese explanation of why this change was made, including grammar rules or natural usage patterns",
      literalTrapVi:
        "optional string: Vietnamese note highlighting literal word-by-word translation traps to avoid (e.g. 'very like' literally translates to 'rất thích', but English uses 'really like')",
      exampleEn:
        "a new, context-relevant example English sentence using the corrected/natural phrase",
      exampleVi: "natural Vietnamese translation of the new example sentence",
      category:
        "idiom | phrasal_verb | technical_term | collocation | grammar_pattern | business_phrase | general_phrase",
      errorType:
        "literal_translation | phrase_misunderstanding | technical_term_misunderstanding | phrasal_verb_error | collocation_error | grammar_structure_misread | pronoun_reference_misread | tone_register_misread | missing_context",
    },
  ],
};

export class DiffAnalysisPrompt implements Prompt<DiffAnalysisResult> {
  public readonly purpose = "analysis";
  public readonly promptVersion = PROMPT_VERSIONS.diffAnalysis;
  public readonly schemaVersion = SCHEMA_VERSIONS.diffAnalysis;
  public readonly schema = diffAnalysisSchema;
  public readonly modelKind = "analysis";
  public readonly expectedShape = diffAnalysisJsonShape;

  constructor(
    private readonly draftText: string,
    private readonly sourceText: string,
    private readonly rawDiffPairs: Array<{ draft: string; corrected: string }>
  ) {}

  render(): string {
    const list = [
      "You are English Context Coach for Vietnamese learners.",
      "Analyze the differences between the learner's DraftText (original, draft version) and the SourceText (the corrected version).",
      "We have run a deterministic word-level diff and extracted the following raw differences/corrections:",
      JSON.stringify(this.rawDiffPairs, null, 2),
      "For each correction, perform AI classification and generate details in Vietnamese following these rules:",
      "1. Keep explanationVi concise, friendly, and practical in Vietnamese. Use markdown backticks (`...`) when referencing English words/phrases inside Vietnamese explanations.",
      "2. Identify literal translation traps if applicable. Set `literalTrapVi` to highlight how word-by-word translation leads to this error (e.g. why the learner chose the draft phrase and why it is a trap). If there is no literal trap, omit it or set it to null.",
      "3. Generate a new context-relevant English example sentence (`exampleEn`) utilizing the corrected phrase. Provide its natural translation (`exampleVi`). Do NOT wrap words in single quotes ('...') or backticks (`...`) in the generated English sentences.",
      "4. Classify the category (idiom, phrasal_verb, etc.) and errorType (literal_translation, collocation_error, grammar_structure_misread, etc.).",
      "5. Classify the overall text type and detected CEFR level (A2, B1, B2, or C1). Provide a short neutral title for the lesson.",
      "Return strict JSON only. No markdown formatting.",
      "JSON shape:",
      JSON.stringify(diffAnalysisJsonShape),
      `Draft text (original):\n${this.draftText}`,
      `Source text (corrected):\n${this.sourceText}`,
    ];

    return list.join("\n\n");
  }
}

export class DiffExercisesPrompt implements Prompt<ExercisesResult> {
  public readonly purpose = "exercise_generation";
  public readonly promptVersion = PROMPT_VERSIONS.exercises;
  public readonly schemaVersion = SCHEMA_VERSIONS.exercises;
  public readonly schema = exercisesSchema;
  public readonly modelKind = "fast";
  public readonly expectedShape = exercisesJsonShape;

  constructor(
    private readonly analysis: SaveAnalysisInput,
    private readonly activeMistakePatterns?: Array<{
      conceptKey: string;
      category: string;
    }>
  ) {}

  render(): string {
    const corrections = this.analysis.correctionItems ?? [];

    const normalize = (phrase: string): string => {
      return phrase
        .toLowerCase()
        .replace(/[“”"'`]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const activePatterns = this.activeMistakePatterns ?? [];
    const correctionsWithMetadata = corrections.map((item) => {
      const normDraft = normalize(item.draftPhrase);
      const normCorrected = normalize(item.correctedPhrase);

      const isRepeated = activePatterns.some((pattern) => {
        const normKey = normalize(pattern.conceptKey.replace(/_/g, " "));
        if (normDraft === normKey || normCorrected === normKey) {
          return true;
        }
        if (
          (normKey.includes(normDraft) && normDraft.length > 3) ||
          (normDraft.includes(normKey) && normKey.length > 3) ||
          (normKey.includes(normCorrected) && normCorrected.length > 3) ||
          (normCorrected.includes(normKey) && normKey.length > 3)
        ) {
          return true;
        }
        return false;
      });

      return {
        ...item,
        isRepeated,
      };
    });

    const list = [
      "You are English Context Coach for Vietnamese learners.",
      "Your task is to generate scaffolded practice exercises for the correction items listed below. Return strict JSON only. No markdown.",
      "For each correction item, you must generate exercises in a strict sequence to help the learner master the correction. The sequence of exercises for each correction depends on whether it is a repeated mistake:",
      "",
      "1. If isRepeated is FALSE (standard mistake):",
      "   Generate exactly 3 exercises in this order:",
      "     - Exercise A (Recognize): type MUST be either `meaning_choice` or `trap_choice` (prefer `trap_choice` if a literal trap is provided). The promptVi should test the difference or meaning in Vietnamese. The phrase field MUST be the exact 'correctedPhrase'.",
      "     - Exercise B (Guided): type MUST be `cloze_phrase`. The promptEn must contain the sentence with '____' (4 underscores) where the corrected phrase should go. The phrase field MUST be the exact 'correctedPhrase'.",
      "     - Exercise C (Produce): type MUST be `phrase_production`. The promptVi should ask the user to write/translate a sentence using the corrected phrase. The phrase field MUST be the exact 'correctedPhrase'.",
      "",
      "2. If isRepeated is TRUE (repeated mistake):",
      "   Skip the recognize step! Generate exactly 2 exercises in this order:",
      "     - Exercise A (Guided): type MUST be `cloze_phrase`. The promptEn must contain the sentence with '____' (4 underscores) where the corrected phrase should go. The phrase field MUST be the exact 'correctedPhrase'.",
      "     - Exercise B (Produce): type MUST be `phrase_production`. The promptVi should ask the user to write/translate a sentence using the corrected phrase. The phrase field MUST be the exact 'correctedPhrase'.",
      "",
      "CRITICAL: The returned list of exercises MUST be ordered sequentially by correction items. That is, all exercises for the first correction item must come first, followed by all exercises for the second correction item, and so on. For each correction item, the exercises must be in the exact order specified above (e.g. recognize -> guided -> produce, or guided -> produce).",
      "",
      "Exercise Types Description:",
      "- meaning_choice: Multiple-choice on phrase meaning. Requires 'choices' array (3-4 items) and 'correctAnswer'. Graded locally.",
      "- trap_choice: Choose natural translation avoiding literal traps. 'choices' array must have 1 natural (correct) + 2-3 literal traps (wrong). Graded locally.",
      "- cloze_phrase: Fill in the blank. 'promptEn' must contain '____' (4 underscores) for the missing phrase.",
      "- phrase_production: Write English sentence containing the phrase. No choices. AI-graded. Requires 'rubricVi' in Vietnamese.",
      "",
      "Wording constraints for promptVi:",
      '- meaning_choice: "Cụm `X` trong câu trên có nghĩa gần nhất với?"',
      '- trap_choice: "Chọn bản dịch tự nhiên nhất, tránh dịch từng từ."',
      '- cloze_phrase: "Điền từ/cụm từ phù hợp vào chỗ trống."',
      '- phrase_production: "Viết một câu tiếng Anh sử dụng cụm `X` để diễn đạt ý: ..."',
      "",
      "Wrap English phrases/terms in markdown backticks (e.g. `really like`) ONLY when referencing them inside Vietnamese prompts or instructions (promptVi). Do NOT wrap key phrases, vocabulary words, or any words in single quotes ('...') or backticks (`...`) inside generated English sentences (promptEn), correct answers, or acceptable answers.",
      "",
      "JSON shape:",
      JSON.stringify(exercisesJsonShape),
      "",
      "Here is the list of Correction Items to generate exercises for:",
      JSON.stringify(correctionsWithMetadata, null, 2),
    ];

    return list.join("\n\n");
  }
}

const writingCoachJsonShape = {
  title:
    "short neutral Vietnamese/English title describing the core correction",
  documentType:
    "email | chat_message | ticket | code_review | technical_doc | meeting_notes | general",
  formality: "formal | semi_formal | casual",
  suggestedText: "the full improved version (AppSuggestion)",
  detectedLevel: "A2 | B1 | B2 | C1",
  summaryVi:
    "summary of the changes made and the learner's intent in Vietnamese",
  naturalTranslationVi: "natural Vietnamese translation of the suggestedText",
  contextExplanationVi:
    "Vietnamese explanation of the context, tone, and appropriate usage",
  toneAnalysisVi:
    "overall tone assessment of the original text compared to the suggested version in Vietnamese",
  corrections: [
    {
      draftPhrase: "the wrong/awkward phrase from the draft text",
      correctedPhrase: "the correct/natural phrase from the suggested text",
      explanationVi:
        "Vietnamese explanation of why this change was made, including grammar rules or natural usage patterns",
      literalTrapVi:
        "optional string: Vietnamese note highlighting literal word-by-word translation traps to avoid. If none, set to null.",
      culturalNoteVi:
        "Vietnamese note explaining the cultural, register, or tone reasons behind this change (e.g. email conventions, Slack thread etiquette, ticket imperative mood, etc.). If none, set to null.",
      exampleEn:
        "a new context-relevant example English sentence using the corrected/natural phrase",
      exampleVi: "natural Vietnamese translation of the new example sentence",
      category:
        "idiom | phrasal_verb | technical_term | collocation | grammar_pattern | business_phrase | general_phrase",
      errorType:
        "literal_translation | phrase_misunderstanding | technical_term_misunderstanding | phrasal_verb_error | collocation_error | grammar_structure_misread | pronoun_reference_misread | tone_register_misread | missing_context",
    },
  ],
};

export class WritingCoachPrompt implements Prompt<WritingCoachAnalysisResult> {
  public readonly purpose = "analysis";
  public readonly promptVersion = PROMPT_VERSIONS.writingCoach;
  public readonly schemaVersion = SCHEMA_VERSIONS.writingCoach;
  public readonly schema = writingCoachAnalysisSchema;
  public readonly modelKind = "analysis";
  public readonly expectedShape = writingCoachJsonShape;

  constructor(private readonly draftText: string) {}

  render(): string {
    const list = [
      "You are English Context Coach for Vietnamese learners.",
      "Analyze the learner's DraftText (original, draft version) and provide corrections, explanations, and context-calibrated improvements.",
      "Follow these steps:",
      "1. Detect the DocumentType of the draft text. Choose from: email, chat_message, ticket, code_review, technical_doc, meeting_notes, general.",
      "2. Detect the Formality of the draft text. Choose from: formal, semi_formal, casual.",
      "3. Generate a full improved version (suggestedText / AppSuggestion) of the text. The suggestedText must calibrate its corrections per the detected DocumentType and Formality:",
      "   - email: teach greeting/closing conventions, hedging, polite indirectness",
      "   - chat_message: allow contractions, catch genuine errors only, teach thread etiquette",
      "   - ticket: teach acceptance criteria format, imperative mood, concise technical writing",
      "   - code_review: teach 'nit:'/'LGTM' conventions, suggestion-vs-request tone",
      "   - technical_doc: teach passive voice conventions, section structure, hedging in rationale",
      "   - meeting_notes: teach action item format, attribution, tense consistency",
      "   - general: baseline English analysis",
      "   And per Formality:",
      "   - formal: strict on hedging, no contractions, full sentences, polite indirectness",
      "   - semi_formal: allow contractions, moderate directness, professional but approachable",
      "   - casual: minimal correction on tone, focus only on genuine errors",
      "4. Identify specific differences/corrections between the learner's DraftText and your suggestedText. For each correction:",
      "   - Keep explanationVi concise, friendly, and practical in Vietnamese. Use markdown backticks (`...`) when referencing English words/phrases inside Vietnamese explanations.",
      "   - Set culturalNoteVi to explain the cultural, tone, register, or channel-specific reasoning behind the change (e.g. why 'check state' is replaced by 'check the status' in an email). If none, set to null.",
      "   - Identify literal translation traps if applicable. Set `literalTrapVi` to highlight how word-by-word translation leads to this error. If none, set to null.",
      "   - Generate a new context-relevant English example sentence (`exampleEn`) utilizing the corrected phrase. Provide its natural translation (`exampleVi`). Do NOT wrap words in single quotes ('...') or backticks (`...`) in the generated English sentences.",
      "   - Classify the category and errorType.",
      "5. Classify the overall CEFR level (A2, B1, B2, or C1) and provide a short neutral title.",
      "6. Provide a toneAnalysisVi (Vietnamese overall tone assessment comparing the draft and suggested versions).",
      "Return strict JSON only. No markdown formatting.",
      "JSON shape:",
      JSON.stringify(writingCoachJsonShape),
      `Draft text (original):\n${this.draftText}`,
    ];

    return list.join("\n\n");
  }
}
