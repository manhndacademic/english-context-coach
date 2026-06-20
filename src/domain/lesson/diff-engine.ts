import type { LLMProvider } from "@/domain/ai";
import { DiffAnalysisPrompt } from "./prompts";
import type { SaveAnalysisInput } from "./ports";
import type { DiffAnalysisResult } from "./schemas";
import { cleanEmbeddedQuotesOrBackticks } from "@/lib/utils";

export type DiffChange =
  | { type: "equal"; text: string }
  | { type: "delete"; text: string }
  | { type: "insert"; text: string };

export interface RawDiffPair {
  draft: string;
  corrected: string;
}

/**
 * Deterministic word-level diffing using standard LCS.
 * Splits text preserving whitespace tokens to align changes accurately.
 */
export function diffWords(draft: string, source: string): DiffChange[] {
  const draftWords = draft.split(/(\s+)/).filter(Boolean);
  const sourceWords = source.split(/(\s+)/).filter(Boolean);

  const n = draftWords.length;
  const m = sourceWords.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0)
  );

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (draftWords[i - 1] === sourceWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const changes: DiffChange[] = [];
  let i = n,
    j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && draftWords[i - 1] === sourceWords[j - 1]) {
      changes.unshift({ type: "equal", text: draftWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      changes.unshift({ type: "insert", text: sourceWords[j - 1] });
      j--;
    } else {
      changes.unshift({ type: "delete", text: draftWords[i - 1] });
      i--;
    }
  }
  return changes;
}

/**
 * Extract contiguous delete and insert blocks as diff correction pairs.
 */
export function extractDiffPairs(changes: DiffChange[]): RawDiffPair[] {
  const pairs: RawDiffPair[] = [];
  let i = 0;
  while (i < changes.length) {
    if (changes[i].type === "equal") {
      i++;
      continue;
    }

    let original = "";
    let corrected = "";

    while (i < changes.length && changes[i].type !== "equal") {
      if (changes[i].type === "delete") {
        original += changes[i].text;
      } else if (changes[i].type === "insert") {
        corrected += changes[i].text;
      }
      i++;
    }

    const cleanOrig = original.trim();
    const cleanCorr = corrected.trim();
    if (cleanOrig || cleanCorr) {
      pairs.push({
        draft: cleanOrig,
        corrected: cleanCorr,
      });
    }
  }
  return pairs;
}

/**
 * Generates diff analysis by running deterministic diff, then calling Gemini to classify corrections.
 */
export async function generateDiffAnalysis(options: {
  draftText: string;
  sourceText: string;
  llm: LLMProvider;
  userId?: string;
  lessonId?: string;
  onThought?: (text: string) => Promise<void>;
}): Promise<SaveAnalysisInput> {
  const { draftText, sourceText, llm, userId, lessonId, onThought } = options;

  // 1. Get deterministic raw diffs
  const diffs = diffWords(draftText, sourceText);
  const rawPairs = extractDiffPairs(diffs);

  // If no differences are found, return a minimal analysis with empty corrections
  if (rawPairs.length === 0) {
    return {
      title: "Bài học luyện tập",
      textType: "general",
      inputMode: "diff",
      detectedLevel: "B1",
      summaryVi:
        "Không phát hiện thấy sự khác biệt nào giữa bản nháp và bản sửa.",
      naturalTranslationVi: "",
      contextExplanationVi: "",
      keyPhrases: [],
      sentenceBreakdowns: [],
      lessonFocuses: [],
      correctionItems: [],
    };
  }

  // 2. Classify raw diffs with Gemini
  const prompt = new DiffAnalysisPrompt(draftText, sourceText, rawPairs);
  const result = (await llm.generateJson({
    userId,
    lessonId,
    prompt,
    onThought,
  })) as DiffAnalysisResult;

  // 3. Map result to SaveAnalysisInput
  return {
    title: result.title || "Bài học sửa lỗi",
    textType: result.textType || "general",
    inputMode: "diff",
    detectedLevel: result.detectedLevel || "B1",
    summaryVi: `Đã tìm thấy ${result.corrections.length} điểm sửa lỗi từ văn bản gốc của bạn.`,
    naturalTranslationVi: "",
    contextExplanationVi: "",
    keyPhrases: [],
    sentenceBreakdowns: [],
    lessonFocuses: [],
    correctionItems: result.corrections.map((item) => ({
      draftPhrase: cleanEmbeddedQuotesOrBackticks(item.draftPhrase),
      correctedPhrase: cleanEmbeddedQuotesOrBackticks(item.correctedPhrase),
      explanationVi: item.explanationVi,
      literalTrapVi: item.literalTrapVi
        ? cleanEmbeddedQuotesOrBackticks(item.literalTrapVi)
        : null,
      exampleEn: cleanEmbeddedQuotesOrBackticks(item.exampleEn),
      exampleVi: cleanEmbeddedQuotesOrBackticks(item.exampleVi),
      category: item.category,
      errorType: item.errorType,
    })),
  };
}
