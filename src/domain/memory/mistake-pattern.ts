import type { MasteryState } from "./types";
import { nextReviewAfterSuccess, nextDueDate, resetDueAfterFailure } from "@/domain/review";
import { masteryStateAfterReview } from "./mastery";

export class MistakePattern {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly conceptKey: string,
    public readonly normalizedPhrase: string,
    public readonly senseKey: string | null,
    public readonly category: "idiom" | "phrasal_verb" | "technical_term" | "collocation" | "grammar_pattern" | "business_phrase" | "general_phrase",
    public readonly errorType: "literal_translation" | "phrase_misunderstanding" | "technical_term_misunderstanding" | "phrasal_verb_error" | "collocation_error" | "grammar_structure_misread" | "pronoun_reference_misread" | "tone_register_misread" | "missing_context",
    public readonly meaningVi: string,
    public readonly safeReviewPromptVi: string,
    public readonly isSensitive: boolean,
    private _occurrenceCount: number,
    private _intervalDays: number,
    private _masteryState: MasteryState,
    private _dueAt: Date,
    private _lastReviewedAt: Date | null,
    public readonly createdAt: Date,
    private _updatedAt: Date,
    // review prompts and job status fields
    private _reviewPromptEn: string | null,
    private _reviewPromptVi: string | null,
    private _reviewRubricVi: string | null,
    private _reviewCorrectAnswer: string | null,
    private _reviewAcceptableAnswers: string[] | null,
    private _reviewPromptStatus: "queued" | "running" | "succeeded" | "failed",
    private _reviewPromptAttempts: number,
    private _reviewPromptError: string | null,
    private _reviewPromptLockedAt: Date | null,
    private _reviewPromptLockedBy: string | null
  ) {}

  static createNew(input: {
    id: string;
    userId: string;
    conceptKey: string;
    normalizedPhrase: string;
    senseKey: string | null;
    category: any;
    errorType: any;
    meaningVi: string;
    safeReviewPromptVi: string;
    isSensitive: boolean;
  }): MistakePattern {
    return new MistakePattern(
      input.id,
      input.userId,
      input.conceptKey,
      input.normalizedPhrase,
      input.senseKey,
      input.category,
      input.errorType,
      input.meaningVi,
      input.safeReviewPromptVi,
      input.isSensitive,
      1, // occurrenceCount
      0, // intervalDays
      "active", // masteryState
      new Date(), // dueAt
      null, // lastReviewedAt
      new Date(), // createdAt
      new Date(), // updatedAt
      null,
      null,
      null,
      null,
      null,
      "queued", // reviewPromptStatus
      0,
      null,
      null,
      null
    );
  }

  static reconstitute(state: any): MistakePattern {
    return new MistakePattern(
      state.id,
      state.userId,
      state.conceptKey,
      state.normalizedPhrase,
      state.senseKey,
      state.category,
      state.errorType,
      state.meaningVi,
      state.safeReviewPromptVi,
      state.isSensitive,
      state.occurrenceCount,
      state.intervalDays,
      state.masteryState,
      state.dueAt,
      state.lastReviewedAt,
      state.createdAt,
      state.updatedAt,
      state.reviewPromptEn,
      state.reviewPromptVi,
      state.reviewRubricVi,
      state.reviewCorrectAnswer,
      state.reviewAcceptableAnswers,
      state.reviewPromptStatus,
      state.reviewPromptAttempts,
      state.reviewPromptError,
      state.reviewPromptLockedAt,
      state.reviewPromptLockedBy
    );
  }

  // Getters for mutated fields
  get occurrenceCount() { return this._occurrenceCount; }
  get intervalDays() { return this._intervalDays; }
  get masteryState() { return this._masteryState; }
  get dueAt() { return this._dueAt; }
  get lastReviewedAt() { return this._lastReviewedAt; }
  get updatedAt() { return this._updatedAt; }
  
  get reviewPromptEn() { return this._reviewPromptEn; }
  get reviewPromptVi() { return this._reviewPromptVi; }
  get reviewRubricVi() { return this._reviewRubricVi; }
  get reviewCorrectAnswer() { return this._reviewCorrectAnswer; }
  get reviewAcceptableAnswers() { return this._reviewAcceptableAnswers; }
  get reviewPromptStatus() { return this._reviewPromptStatus; }
  get reviewPromptAttempts() { return this._reviewPromptAttempts; }
  get reviewPromptError() { return this._reviewPromptError; }
  get reviewPromptLockedAt() { return this._reviewPromptLockedAt; }
  get reviewPromptLockedBy() { return this._reviewPromptLockedBy; }

  // Business operations (Mutators)
  incrementOccurrence() {
    this._occurrenceCount += 1;
    this._intervalDays = 0;
    this._masteryState = "active";
    this._dueAt = new Date();
    this._updatedAt = new Date();
    if (!this._reviewPromptEn) {
      this._reviewPromptStatus = "queued";
    }
  }

  recordReviewAttempt(isCorrect: boolean, now = new Date()) {
    this._intervalDays = isCorrect ? nextReviewAfterSuccess(this._intervalDays) : 0;
    this._dueAt = isCorrect ? nextDueDate(this._intervalDays, now) : resetDueAfterFailure(now);
    this._masteryState = masteryStateAfterReview(isCorrect, this._intervalDays);
    this._lastReviewedAt = now;
    this._updatedAt = now;
  }

  claimJob(workerId: string, now = new Date()) {
    this._reviewPromptStatus = "running";
    this._reviewPromptLockedAt = now;
    this._reviewPromptLockedBy = workerId;
    this._reviewPromptAttempts += 1;
    this._updatedAt = now;
  }

  updateReviewPrompt(prompts: {
    reviewPromptEn: string;
    reviewPromptVi: string;
    reviewRubricVi: string;
    reviewCorrectAnswer: string;
    reviewAcceptableAnswers: string[];
  }) {
    this._reviewPromptEn = prompts.reviewPromptEn;
    this._reviewPromptVi = prompts.reviewPromptVi;
    this._reviewRubricVi = prompts.reviewRubricVi;
    this._reviewCorrectAnswer = prompts.reviewCorrectAnswer;
    this._reviewAcceptableAnswers = prompts.reviewAcceptableAnswers;
    this._reviewPromptStatus = "succeeded";
    this._reviewPromptError = null;
    this._reviewPromptLockedAt = null;
    this._reviewPromptLockedBy = null;
    this._updatedAt = new Date();
  }

  setJobStatus(status: "queued" | "running" | "succeeded" | "failed", extra?: any) {
    this._reviewPromptStatus = status;
    this._updatedAt = new Date();
    if (extra) {
      if (extra.reviewPromptError !== undefined) this._reviewPromptError = extra.reviewPromptError;
      if (extra.reviewPromptAttempts !== undefined) this._reviewPromptAttempts = extra.reviewPromptAttempts;
      if (extra.reviewPromptLockedAt !== undefined) this._reviewPromptLockedAt = extra.reviewPromptLockedAt;
      if (extra.reviewPromptLockedBy !== undefined) this._reviewPromptLockedBy = extra.reviewPromptLockedBy;
    }
  }

  needsReviewPromptGeneration(): boolean {
    return this._reviewPromptStatus === "queued" && !this._reviewPromptEn;
  }

  toDbRow(): Record<string, any> {
    return {
      id: this.id,
      userId: this.userId,
      conceptKey: this.conceptKey,
      normalizedPhrase: this.normalizedPhrase,
      senseKey: this.senseKey,
      category: this.category,
      errorType: this.errorType,
      meaningVi: this.meaningVi,
      safeReviewPromptVi: this.safeReviewPromptVi,
      isSensitive: this.isSensitive,
      occurrenceCount: this._occurrenceCount,
      intervalDays: this._intervalDays,
      masteryState: this._masteryState,
      dueAt: this._dueAt,
      lastReviewedAt: this._lastReviewedAt,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
      reviewPromptEn: this._reviewPromptEn,
      reviewPromptVi: this._reviewPromptVi,
      reviewRubricVi: this._reviewRubricVi,
      reviewCorrectAnswer: this._reviewCorrectAnswer,
      reviewAcceptableAnswers: this._reviewAcceptableAnswers,
      reviewPromptStatus: this._reviewPromptStatus,
      reviewPromptAttempts: this._reviewPromptAttempts,
      reviewPromptError: this._reviewPromptError,
      reviewPromptLockedAt: this._reviewPromptLockedAt,
      reviewPromptLockedBy: this._reviewPromptLockedBy,
    };
  }
}
