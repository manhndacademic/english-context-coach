const sensitivePatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\bhttps?:\/\/\S+/i,
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/,
  /\b[A-Z]{2,}-\d+\b/,
  /\b(?:project|client|customer|repo|repository|ticket|issue)\s+[A-Z0-9_-]{3,}\b/i,
];

export function containsSourceIdentifyingContent(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return sensitivePatterns.some((pattern) => pattern.test(trimmed));
}

export const genericSafeReviewMeaningVi =
  "Ôn lại nghĩa tự nhiên trong ngữ cảnh.";
export const genericSafeReviewExplanationVi =
  "Luyện lại cách hiểu ý thay vì dựa vào chi tiết riêng của nguồn gốc.";

export function sanitizeLearnerFacingText(
  value: string,
  fallback = genericSafeReviewMeaningVi,
) {
  const trimmed = value.trim();
  if (!trimmed || containsSourceIdentifyingContent(trimmed)) return fallback;
  return trimmed;
}

export function isLearnerSafeReviewSeed(input: {
  normalizedPhrase: string;
  meaningVi: string;
  explanationVi?: string;
  isSensitive?: boolean;
}) {
  return !(
    input.isSensitive ||
    containsSourceIdentifyingContent(input.normalizedPhrase) ||
    containsSourceIdentifyingContent(input.meaningVi) ||
    containsSourceIdentifyingContent(input.explanationVi ?? "")
  );
}

export function shouldScrubMistakePattern(input: {
  normalizedPhrase: string;
  meaningVi: string;
  safeReviewPromptVi: string;
}) {
  return (
    containsSourceIdentifyingContent(input.normalizedPhrase) ||
    containsSourceIdentifyingContent(input.meaningVi) ||
    containsSourceIdentifyingContent(input.safeReviewPromptVi)
  );
}

export function shouldRetainAfterSourceDeletion(input: {
  evidenceCountBeforeDeletion: number;
  evidenceCountFromDeletedSource: number;
}) {
  const remainingEvidence = Math.max(
    0,
    input.evidenceCountBeforeDeletion - input.evidenceCountFromDeletedSource,
  );
  return {
    remainingEvidence,
    retainPatternOrConcept: remainingEvidence > 0,
  };
}
