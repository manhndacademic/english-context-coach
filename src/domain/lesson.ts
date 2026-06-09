import type { AnalysisResult, ExercisesResult } from "@/lib/ai/schemas";
import { normalizePhrase } from "./text";

function includesPhrase(sourceText: string, phrase: string) {
  return sourceText.toLowerCase().includes(phrase.toLowerCase());
}

function isOverlappingDuplicate(a: string, b: string) {
  const normalizedA = normalizePhrase(a);
  const normalizedB = normalizePhrase(b);
  const tokensA = normalizedA.split(" ");
  const tokensB = normalizedB.split(" ");
  const isSubsequence = (shorter: string[], longer: string[]) => {
    let cursor = 0;
    for (const token of longer) {
      if (token === shorter[cursor]) cursor += 1;
      if (cursor === shorter.length) return true;
    }
    return false;
  };

  return (
    normalizedA === normalizedB ||
    normalizedA.includes(normalizedB) ||
    normalizedB.includes(normalizedA) ||
    isSubsequence(tokensA, tokensB) ||
    isSubsequence(tokensB, tokensA)
  );
}

function choosePhrase(current: AnalysisResult["keyPhrases"][number], candidate: AnalysisResult["keyPhrases"][number], sourceText: string) {
  const currentInSource = includesPhrase(sourceText, current.phrase);
  const candidateInSource = includesPhrase(sourceText, candidate.phrase);
  if (candidateInSource !== currentInSource) return candidateInSource ? candidate : current;
  if (candidate.phrase.length !== current.phrase.length) {
    return candidate.phrase.length > current.phrase.length ? candidate : current;
  }
  return current;
}

export function dedupeKeyPhrases(phrases: AnalysisResult["keyPhrases"], sourceText: string) {
  const deduped: AnalysisResult["keyPhrases"] = [];

  for (const phrase of phrases) {
    const existingIndex = deduped.findIndex(
      (existing) =>
        existing.category === phrase.category &&
        isOverlappingDuplicate(existing.phrase, phrase.phrase),
    );

    if (existingIndex === -1) {
      deduped.push(phrase);
      continue;
    }

    deduped[existingIndex] = choosePhrase(deduped[existingIndex], phrase, sourceText);
  }

  return deduped;
}

export function prepareAnalysisForSave(analysis: AnalysisResult, sourceText: string): AnalysisResult {
  return {
    ...analysis,
    keyPhrases: dedupeKeyPhrases(analysis.keyPhrases, sourceText),
  };
}

export function exerciseCompletenessIssues(result: ExercisesResult, analysis: AnalysisResult) {
  const issues: string[] = [];
  if (result.exercises.length < 3) issues.push("A complete Lesson needs at least 3 Exercises.");
  if (!result.exercises.some((exercise) => exercise.type === "focus_question")) {
    issues.push("A complete Lesson needs at least one LessonFocus Exercise.");
  }
  if (
    analysis.keyPhrases.length > 0 &&
    !result.exercises.some((exercise) => "phrase" in exercise && exercise.phrase.trim().length > 0)
  ) {
    issues.push("A complete Lesson with KeyPhrases needs at least one KeyPhrase Exercise.");
  }

  const focusTitles = new Set(analysis.lessonFocuses.map((focus) => normalizePhrase(focus.title)));
  const invalidFocus = result.exercises.find(
    (exercise) => exercise.type === "focus_question" && !focusTitles.has(normalizePhrase(exercise.focus)),
  );
  const invalidFocusTitle = invalidFocus?.type === "focus_question" ? invalidFocus.focus : null;
  if (invalidFocusTitle) issues.push(`Focus question targets an unknown LessonFocus: ${invalidFocusTitle}`);

  return issues;
}

export function assertCompleteExercises(result: ExercisesResult, analysis: AnalysisResult) {
  const issues = exerciseCompletenessIssues(result, analysis);
  if (issues.length) {
    throw new Error(`Exercise generation is incomplete: ${issues.join(" ")}`);
  }
}
