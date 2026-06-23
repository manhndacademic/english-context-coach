import type { SaveAnalysisInput, SaveExercisesInput } from "./ports";
import type { TextProcessor } from "@/domain/text";

function includesPhrase(sourceText: string, phrase: string) {
  return sourceText.toLowerCase().includes(phrase.toLowerCase());
}

function isOverlappingDuplicate(
  a: string,
  b: string,
  textProcessor: TextProcessor
) {
  const normalizedA = textProcessor.normalizePhrase(a);
  const normalizedB = textProcessor.normalizePhrase(b);
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

function choosePhrase(
  current: SaveAnalysisInput["keyPhrases"][number],
  candidate: SaveAnalysisInput["keyPhrases"][number],
  sourceText: string
) {
  const currentInSource = includesPhrase(sourceText, current.phrase);
  const candidateInSource = includesPhrase(sourceText, candidate.phrase);
  if (candidateInSource !== currentInSource)
    return candidateInSource ? candidate : current;
  if (candidate.phrase.length !== current.phrase.length) {
    return candidate.phrase.length > current.phrase.length
      ? candidate
      : current;
  }
  return current;
}

export function dedupeKeyPhrases(
  phrases: SaveAnalysisInput["keyPhrases"],
  sourceText: string,
  textProcessor: TextProcessor
) {
  const deduped: SaveAnalysisInput["keyPhrases"] = [];

  for (const phrase of phrases) {
    const existingIndex = deduped.findIndex(
      (existing) =>
        existing.category === phrase.category &&
        isOverlappingDuplicate(existing.phrase, phrase.phrase, textProcessor)
    );

    if (existingIndex === -1) {
      deduped.push(phrase);
      continue;
    }

    deduped[existingIndex] = choosePhrase(
      deduped[existingIndex],
      phrase,
      sourceText
    );
  }

  return deduped;
}

export function prepareAnalysisForSave(
  analysis: SaveAnalysisInput,
  sourceText: string,
  textProcessor: TextProcessor
): SaveAnalysisInput {
  return {
    ...analysis,
    keyPhrases: dedupeKeyPhrases(
      analysis.keyPhrases,
      sourceText,
      textProcessor
    ),
  };
}

export function findMatchingLessonFocus<
  T extends {
    title?: string | null;
    conceptPhrase?: string | null;
    conceptKey?: string | null;
    category?: string | null;
  },
>(
  exerciseFocus: string,
  focuses: T[],
  textProcessor: TextProcessor
): T | undefined {
  const normExercise = textProcessor.normalizePhrase(exerciseFocus);
  if (!normExercise) return undefined;

  // 1. Try exact matches first
  for (const focus of focuses) {
    const targets = [
      focus.title ? textProcessor.normalizePhrase(focus.title) : "",
      focus.conceptPhrase
        ? textProcessor.normalizePhrase(focus.conceptPhrase)
        : "",
      focus.conceptKey ? textProcessor.normalizePhrase(focus.conceptKey) : "",
      focus.conceptKey
        ? textProcessor.normalizePhrase(focus.conceptKey.replace(/_/g, " "))
        : "",
      focus.category ? textProcessor.normalizePhrase(focus.category) : "",
    ].filter(Boolean);

    if (targets.includes(normExercise)) {
      return focus;
    }
  }

  // 2. Try substring/contains matches next (for target length > 3 to avoid false positives on short terms)
  for (const focus of focuses) {
    const targets = [
      focus.title ? textProcessor.normalizePhrase(focus.title) : "",
      focus.conceptPhrase
        ? textProcessor.normalizePhrase(focus.conceptPhrase)
        : "",
      focus.conceptKey ? textProcessor.normalizePhrase(focus.conceptKey) : "",
      focus.conceptKey
        ? textProcessor.normalizePhrase(focus.conceptKey.replace(/_/g, " "))
        : "",
    ].filter(Boolean);

    for (const target of targets) {
      if (
        (normExercise.includes(target) && target.length > 3) ||
        (target.includes(normExercise) && normExercise.length > 3)
      ) {
        return focus;
      }
    }
  }

  return undefined;
}

export function exerciseCompletenessIssues(
  result: SaveExercisesInput,
  analysis: SaveAnalysisInput,
  textProcessor: TextProcessor
) {
  const issues: string[] = [];
  if (analysis.inputMode === "diff" || analysis.inputMode === "write") {
    if (
      analysis.correctionItems &&
      analysis.correctionItems.length > 0 &&
      result.exercises.length === 0
    ) {
      issues.push("A complete diff Lesson needs at least one Exercise.");
    }
  } else {
    if (result.exercises.length < 5)
      issues.push("A complete Lesson needs at least 5 Exercises.");
    if (
      !result.exercises.some((exercise) => exercise.type === "focus_question")
    ) {
      issues.push("A complete Lesson needs at least one LessonFocus Exercise.");
    }
    if (
      analysis.keyPhrases.length > 0 &&
      !result.exercises.some(
        (exercise) =>
          exercise.phrase !== undefined && exercise.phrase.trim().length > 0
      )
    ) {
      issues.push(
        "A complete Lesson with KeyPhrases needs at least one KeyPhrase Exercise."
      );
    }

    const invalidFocus = result.exercises.find(
      (exercise) =>
        exercise.type === "focus_question" &&
        exercise.focus &&
        !findMatchingLessonFocus(
          exercise.focus,
          analysis.lessonFocuses,
          textProcessor
        )
    );
    const invalidFocusTitle =
      invalidFocus?.type === "focus_question" ? invalidFocus.focus : null;
    if (invalidFocusTitle)
      issues.push(
        `Focus question targets an unknown LessonFocus: ${invalidFocusTitle}`
      );
  }

  return issues;
}

export function assertCompleteExercises(
  result: SaveExercisesInput,
  analysis: SaveAnalysisInput,
  textProcessor: TextProcessor
) {
  const issues = exerciseCompletenessIssues(result, analysis, textProcessor);
  if (issues.length) {
    throw new Error(`Exercise generation is incomplete: ${issues.join(" ")}`);
  }
}
