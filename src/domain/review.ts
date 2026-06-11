import { normalizePhrase } from "./text";

export type MasteryState = "new" | "learning" | "reviewing" | "mastered" | "relearning";
export type ReviewResult = "correct" | "partially_correct" | "incorrect" | "grading_failed";
export type GradingStatus = "pending" | "succeeded" | "failed";
export type ReviewExerciseType =
  | "meaning_choice"
  | "cloze_phrase"
  | "natural_interpretation"
  | "context_explanation"
  | "tone_structure_purpose";

export type ReviewPromptSnapshot = {
  type: ReviewExerciseType;
  promptVi: string;
  promptEn?: string;
  choices?: string[];
  correctAnswer?: string;
  acceptableAnswers?: string[];
  rubricVi?: string;
  conceptTitleVi: string;
};

export type MistakeConceptSeed = {
  normalizedPhrase: string;
  senseKey: string;
  category: string;
  errorType: string;
  meaningVi: string;
  explanationVi: string;
  isSensitive?: boolean;
};

const REVIEW_INTERVALS = [1, 3, 7, 14] as const;

export function nextReviewAfterSuccess(currentIntervalDays: number) {
  const next = REVIEW_INTERVALS.find((interval) => interval > currentIntervalDays);
  return next ?? REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1];
}

export function nextDueDate(intervalDays: number, from = new Date()) {
  const due = new Date(from);
  due.setDate(due.getDate() + intervalDays);
  return due;
}

export function resetDueAfterFailure(from = new Date()) {
  const due = new Date(from);
  due.setDate(due.getDate() + 1);
  return due;
}

export function resultFromScore(score: number): Exclude<ReviewResult, "grading_failed"> {
  if (score >= 80) return "correct";
  if (score >= 50) return "partially_correct";
  return "incorrect";
}

export function transitionMastery(input: {
  currentState: MasteryState;
  currentIntervalDays: number;
  result: ReviewResult;
  gradingStatus: GradingStatus;
}) {
  if (input.gradingStatus !== "succeeded" || input.result === "grading_failed") {
    return {
      nextState: input.currentState,
      nextIntervalDays: input.currentIntervalDays,
      shouldSchedule: false,
    };
  }

  if (input.result === "incorrect") {
    return { nextState: "relearning" as const, nextIntervalDays: 1, shouldSchedule: true };
  }

  if (input.result === "partially_correct") {
    const nextState = input.currentState === "mastered" ? "relearning" : input.currentState === "new" ? "learning" : input.currentState;
    return { nextState, nextIntervalDays: 1, shouldSchedule: true };
  }

  const nextIntervalDays = nextReviewAfterSuccess(input.currentIntervalDays);
  const nextState =
    input.currentState === "new"
      ? "learning"
      : input.currentState === "learning"
        ? "reviewing"
        : input.currentState === "relearning"
          ? "reviewing"
          : nextIntervalDays >= 14 && input.currentIntervalDays >= 14
            ? "mastered"
            : input.currentState === "mastered"
              ? "mastered"
              : "reviewing";

  return { nextState, nextIntervalDays, shouldSchedule: true };
}

export function applyNewLessonErrorToMastery(currentState: MasteryState) {
  if (currentState === "mastered") return "relearning" as const;
  if (currentState === "new") return "learning" as const;
  return currentState;
}

function broadConceptKey(input: MistakeConceptSeed) {
  const phrase = normalizePhrase(input.normalizedPhrase);
  const sense = normalizePhrase(input.senseKey);
  const meaning = normalizePhrase(input.meaningVi);

  if (
    input.errorType === "phrasal_verb_error" &&
    /\b(push|move|set|put).*\bback\b|\bback\b.*\b(meeting|call|deadline|schedule)\b/.test(`${phrase} ${sense} ${meaning}`)
  ) {
    return "phrasal_verb:schedule_movement_back";
  }

  if (input.errorType === "literal_translation" && (input.category === "idiom" || input.category === "business_phrase")) {
    return `literal_translation:${input.category}:${sense}`;
  }

  if (input.errorType === "pronoun_reference_misread") {
    return `pronoun_reference:${sense}`;
  }

  if (input.errorType === "tone_register_misread") {
    return `tone_register:${sense}`;
  }

  return null;
}

export function deterministicConceptKey(input: MistakeConceptSeed) {
  return broadConceptKey(input) ?? `${input.errorType}:${input.category}:${normalizePhrase(input.senseKey)}`;
}

export function conceptTitleVi(input: MistakeConceptSeed) {
  if (input.isSensitive) return "Ôn lại một điểm nghĩa trong ngữ cảnh";
  const key = deterministicConceptKey(input);
  if (key === "phrasal_verb:schedule_movement_back") return "Cụm động từ diễn tả dời lịch";
  if (input.errorType === "literal_translation") return "Tránh dịch từng từ trong ngữ cảnh";
  if (input.errorType === "pronoun_reference_misread") return "Xác định đúng đại từ đang nói tới ai hoặc điều gì";
  if (input.errorType === "tone_register_misread") return "Đọc đúng sắc thái lịch sự hoặc gián tiếp";
  return `Ôn lại: ${input.normalizedPhrase}`;
}

export function buildSafeReviewSeed(input: MistakeConceptSeed) {
  if (input.isSensitive) {
    return {
      category: input.category,
      errorType: input.errorType,
      meaningVi: "Ôn lại nghĩa tự nhiên trong ngữ cảnh.",
      explanationVi: "Luyện lại cách hiểu ý thay vì dựa vào chi tiết riêng của nguồn gốc.",
    };
  }

  return {
    phrase: input.isSensitive ? undefined : input.normalizedPhrase,
    meaningVi: input.meaningVi,
    explanationVi: input.explanationVi,
    category: input.category,
    errorType: input.errorType,
  };
}

export function buildReviewPromptSnapshot(input: {
  conceptTitleVi: string;
  safeReviewSeed: Record<string, unknown>;
  fallbackMeaningVi: string;
}): ReviewPromptSnapshot {
  const phrase = typeof input.safeReviewSeed.phrase === "string" ? input.safeReviewSeed.phrase : "";
  const meaningVi = typeof input.safeReviewSeed.meaningVi === "string" ? input.safeReviewSeed.meaningVi : input.fallbackMeaningVi;

  if (phrase) {
    return {
      type: "cloze_phrase",
      conceptTitleVi: input.conceptTitleVi,
      promptVi: "Điền cụm tiếng Anh tự nhiên phù hợp với ý nghĩa trong ngữ cảnh.",
      promptEn: `In a work context, this can mean: "${meaningVi}". Phrase: ____`,
      correctAnswer: phrase,
      acceptableAnswers: [phrase],
      rubricVi: "Câu trả lời cần khớp cụm tiếng Anh đang được ôn, không cần nhắc lại câu gốc.",
    };
  }

  return {
    type: "context_explanation",
    conceptTitleVi: input.conceptTitleVi,
    promptVi: `Giải thích bằng tiếng Việt cách hiểu tự nhiên của điểm này: ${input.conceptTitleVi}`,
    rubricVi: "Câu trả lời cần nêu được ý nghĩa tự nhiên trong ngữ cảnh, không dịch từng từ.",
  };
}
