import type { Exercise, KeyPhrase, LessonFocus } from "@/domain/lesson/ports";

export interface Attempt {
  id: string;
  exerciseId: string;
  lessonId: string;
  userId: string;
  answer: string;
  score: number;
  isCorrect: boolean;
  feedbackVi: string;
  gradingMetadata: Record<string, any> | null;
  createdAt: Date;
}

export interface UserError {
  id: string;
  userId: string;
  attemptId: string | null;
  lessonId: string | null;
  keyPhraseId?: string | null;
  lessonFocusId?: string | null;
  errorType: string;
  conceptKey: string;
  normalizedPhrase: string;
  senseKey: string;
  explanationVi: string;
  isSourceSensitive: boolean;
  isRepeated: boolean;
  createdAt: Date;
}

export interface MistakePattern {
  id: string;
  userId: string;
  conceptKey: string;
  normalizedPhrase: string;
  senseKey: string | null;
  category: "idiom" | "phrasal_verb" | "technical_term" | "collocation" | "grammar_pattern" | "business_phrase" | "general_phrase";
  errorType: "literal_translation" | "phrase_misunderstanding" | "technical_term_misunderstanding" | "phrasal_verb_error" | "collocation_error" | "grammar_structure_misread" | "pronoun_reference_misread" | "tone_register_misread" | "missing_context";
  meaningVi: string;
  safeReviewPromptVi: string;
  isSensitive: boolean;
  occurrenceCount: number;
  intervalDays: number;
  dueAt: Date;
  lastReviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  reviewPromptEn: string | null;
  reviewPromptVi: string | null;
  reviewRubricVi: string | null;
  reviewCorrectAnswer: string | null;
  reviewAcceptableAnswers: string[] | null;
}

export interface ReviewAttempt {
  id: string;
  userId: string;
  mistakePatternId: string;
  answer: string;
  score: number;
  isCorrect: boolean;
  feedbackVi: string;
  createdAt: Date;
}

export type MasteryState = "due" | "active" | "mastered";


export interface SubmitAttemptInput {
  userId: string;
  exerciseId: string;
  lessonId: string;
  answer: string;
}

export interface AttemptFormResult {
  success: boolean;
  isCorrect: boolean;
  score: number;
  feedbackVi: string;
  userErrorCreated: boolean;
  mistakePatternStatus: "new" | "repeated" | "none";
  error?: string;
}

export interface SubmitReviewAttemptInput {
  userId: string;
  patternId: string;
  answer: string;
}

export interface ReviewFormResult {
  success: boolean;
  isCorrect: boolean;
  score: number;
  feedbackVi: string;
  masteryStateUpdated: boolean;
  nextReviewAt?: Date;
  error?: string;
}

export interface LearnerMemoryEngine {
  submitAttempt(input: SubmitAttemptInput): Promise<AttemptFormResult>;
  submitReviewAttempt(input: SubmitReviewAttemptInput): Promise<ReviewFormResult>;
  generateReviewPrompt(patternId: string): Promise<void>;
}
