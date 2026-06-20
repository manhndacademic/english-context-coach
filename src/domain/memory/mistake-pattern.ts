import type { MasteryState } from "./types";
import type {
  KeyPhraseCategory,
  UserErrorType,
  JobStatus,
} from "@/domain/types";

export class MistakePattern {
  public static readonly REVIEW_INTERVALS = [1, 3, 7, 14];
  public static readonly MASTERED_INTERVAL_DAYS = 14;

  public static nextReviewAfterSuccess(currentIntervalDays: number): number {
    const next = MistakePattern.REVIEW_INTERVALS.find(
      (interval) => interval > currentIntervalDays
    );
    return (
      next ??
      MistakePattern.REVIEW_INTERVALS[
        MistakePattern.REVIEW_INTERVALS.length - 1
      ]
    );
  }

  public static nextDueDate(intervalDays: number, from = new Date()): Date {
    const due = new Date(from);
    due.setDate(due.getDate() + intervalDays);
    return due;
  }

  public static resetDueAfterFailure(from = new Date()): Date {
    const due = new Date(from);
    due.setDate(due.getDate() + 1);
    return due;
  }

  public static masteryStateAfterReview(
    isCorrect: boolean,
    intervalDays: number
  ): MasteryState {
    return isCorrect && intervalDays >= MistakePattern.MASTERED_INTERVAL_DAYS
      ? "mastered"
      : "active";
  }

  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly conceptKey: string,
    public readonly normalizedPhrase: string,
    public readonly senseKey: string | null,
    public readonly category: KeyPhraseCategory,
    public readonly errorType: UserErrorType,
    public readonly meaningVi: string,
    public readonly safeReviewPromptVi: string,
    public readonly isSensitive: boolean,
    private _occurrenceCount: number,
    private _intervalDays: number,
    private _easeFactor: number,
    private _repetitions: number,
    private _masteryState: MasteryState,
    private _dueAt: Date,
    private _lastReviewedAt: Date | null,
    public readonly createdAt: Date,
    private _updatedAt: Date,
    private _reviewPromptEn: string | null,
    private _reviewPromptVi: string | null,
    private _reviewRubricVi: string | null,
    private _reviewCorrectAnswer: string | null,
    private _reviewAcceptableAnswers: string[] | null,
    private _reviewType: string,
    private _reviewChoices: string[] | null,
    private _reviewPromptStatus: JobStatus,
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
      2.5, // easeFactor
      0, // repetitions
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
      "natural_translation", // reviewType
      null, // reviewChoices
      "queued", // reviewPromptStatus
      0,
      null,
      null,
      null
    );
  }

  /**
   * Factory for review cards seeded directly from an AI-extracted key phrase.
   * These enter the SRS queue immediately with dueAt=now so the user
   * can start practising right away.
   */
  static createFromPhrase(input: {
    id: string;
    userId: string;
    keyPhraseId: string;
    conceptKey: string;
    normalizedPhrase: string;
    senseKey: string | null;
    category: any;
    meaningVi: string;
    isSensitive: boolean;
  }): MistakePattern {
    return new MistakePattern(
      input.id,
      input.userId,
      input.conceptKey,
      input.normalizedPhrase,
      input.senseKey,
      input.category,
      // phrase-sourced cards use 'phrase_misunderstanding' as a neutral
      // error type so they participate in the SRS without skewing mistake stats
      "phrase_misunderstanding",
      input.meaningVi,
      input.meaningVi, // safeReviewPromptVi — safe copy, no original context
      input.isSensitive,
      1, // occurrenceCount
      0, // intervalDays
      2.5, // easeFactor
      0, // repetitions
      "active", // masteryState
      new Date(), // dueAt — due immediately
      null, // lastReviewedAt
      new Date(), // createdAt
      new Date(), // updatedAt
      null,
      null,
      null,
      null,
      null,
      "natural_translation", // reviewType
      null, // reviewChoices
      "queued", // reviewPromptStatus — triggers AI review prompt generation
      0,
      null,
      null,
      null
    );
  }

  static reconstitute(state: any): MistakePattern {
    const parseDate = (val: any) => {
      if (!val) return null;
      if (val instanceof Date) return val;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };
    const parseDateRequired = (val: any) => {
      const d = parseDate(val);
      return d ?? new Date();
    };

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
      state.easeFactor ?? 2.5,
      state.repetitions ?? 0,
      state.masteryState,
      parseDateRequired(state.dueAt),
      parseDate(state.lastReviewedAt),
      parseDateRequired(state.createdAt),
      parseDateRequired(state.updatedAt),
      state.reviewPromptEn,
      state.reviewPromptVi,
      state.reviewRubricVi,
      state.reviewCorrectAnswer,
      state.reviewAcceptableAnswers,
      state.reviewType ?? "natural_translation",
      state.reviewChoices ?? null,
      state.reviewPromptStatus,
      state.reviewPromptAttempts,
      state.reviewPromptError,
      parseDate(state.reviewPromptLockedAt),
      state.reviewPromptLockedBy
    );
  }

  get easeFactor() {
    return this._easeFactor;
  }
  get repetitions() {
    return this._repetitions;
  }
  get occurrenceCount() {
    return this._occurrenceCount;
  }
  get intervalDays() {
    return this._intervalDays;
  }
  get masteryState() {
    return this._masteryState;
  }
  get dueAt() {
    return this._dueAt;
  }
  get lastReviewedAt() {
    return this._lastReviewedAt;
  }
  get updatedAt() {
    return this._updatedAt;
  }

  get reviewPromptEn() {
    return this._reviewPromptEn;
  }
  get reviewPromptVi() {
    return this._reviewPromptVi;
  }
  get reviewRubricVi() {
    return this._reviewRubricVi;
  }
  get reviewCorrectAnswer() {
    return this._reviewCorrectAnswer;
  }
  get reviewAcceptableAnswers() {
    return this._reviewAcceptableAnswers;
  }
  get reviewType() {
    return this._reviewType;
  }
  get reviewChoices() {
    return this._reviewChoices;
  }
  get reviewPromptStatus() {
    return this._reviewPromptStatus;
  }
  get reviewPromptAttempts() {
    return this._reviewPromptAttempts;
  }
  get reviewPromptError() {
    return this._reviewPromptError;
  }
  get reviewPromptLockedAt() {
    return this._reviewPromptLockedAt;
  }
  get reviewPromptLockedBy() {
    return this._reviewPromptLockedBy;
  }

  // Business operations (Mutators)
  incrementOccurrence() {
    this._occurrenceCount += 1;
    this._intervalDays = 0;
    this._repetitions = 0;
    this._masteryState = "active";
    this._dueAt = new Date();
    this._updatedAt = new Date();
    if (!this._reviewPromptEn) {
      this._reviewPromptStatus = "queued";
    }
  }

  isDue(now = new Date()): boolean {
    return (
      this._masteryState === "active" &&
      this._reviewPromptStatus === "succeeded" &&
      this._dueAt.getTime() <= now.getTime()
    );
  }

  recordReviewAttempt(isCorrect: boolean, score?: number, now = new Date()) {
    let q: number;
    if (score !== undefined) {
      if (score >= 95) q = 5;
      else if (score >= 80) q = 4;
      else if (score >= 70) q = 3;
      else if (score >= 50) q = 2;
      else if (score >= 30) q = 1;
      else q = 0;
    } else {
      q = isCorrect ? 4 : 1;
    }

    // Update Ease Factor (EF)
    this._easeFactor =
      this._easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (this._easeFactor < 1.3) {
      this._easeFactor = 1.3;
    }

    if (q >= 3) {
      this._repetitions += 1;
      if (this._repetitions === 1) {
        this._intervalDays = 1;
      } else if (this._repetitions === 2) {
        this._intervalDays = 3;
      } else {
        this._intervalDays = Math.round(this._intervalDays * this._easeFactor);
      }
      this._dueAt = new Date(now);
      this._dueAt.setDate(this._dueAt.getDate() + this._intervalDays);
    } else {
      this._repetitions = 0;
      this._intervalDays = 0;
      this._dueAt = new Date(now);
      this._dueAt.setDate(this._dueAt.getDate() + 1); // due tomorrow
    }

    this._masteryState =
      this._intervalDays >= MistakePattern.MASTERED_INTERVAL_DAYS
        ? "mastered"
        : "active";
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
    reviewType: string;
    reviewPromptEn: string;
    reviewPromptVi: string;
    reviewRubricVi: string;
    reviewCorrectAnswer: string;
    reviewAcceptableAnswers: string[];
    reviewChoices: string[] | null;
  }) {
    this._reviewType = prompts.reviewType;
    this._reviewPromptEn = prompts.reviewPromptEn;
    this._reviewPromptVi = prompts.reviewPromptVi;
    this._reviewRubricVi = prompts.reviewRubricVi;
    this._reviewCorrectAnswer = prompts.reviewCorrectAnswer;
    this._reviewAcceptableAnswers = prompts.reviewAcceptableAnswers;
    this._reviewChoices = prompts.reviewChoices ?? null;
    this._reviewPromptStatus = "succeeded";
    this._reviewPromptError = null;
    this._reviewPromptLockedAt = null;
    this._reviewPromptLockedBy = null;
    this._updatedAt = new Date();
  }

  setJobStatus(status: JobStatus, extra?: any) {
    this._reviewPromptStatus = status;
    this._updatedAt = new Date();
    if (extra) {
      if (extra.reviewPromptError !== undefined)
        this._reviewPromptError = extra.reviewPromptError;
      if (extra.reviewPromptAttempts !== undefined)
        this._reviewPromptAttempts = extra.reviewPromptAttempts;
      if (extra.reviewPromptLockedAt !== undefined)
        this._reviewPromptLockedAt = extra.reviewPromptLockedAt;
      if (extra.reviewPromptLockedBy !== undefined)
        this._reviewPromptLockedBy = extra.reviewPromptLockedBy;
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
      easeFactor: this._easeFactor,
      repetitions: this._repetitions,
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
      reviewType: this._reviewType,
      reviewChoices: this._reviewChoices,
      reviewPromptStatus: this._reviewPromptStatus,
      reviewPromptAttempts: this._reviewPromptAttempts,
      reviewPromptError: this._reviewPromptError,
      reviewPromptLockedAt: this._reviewPromptLockedAt,
      reviewPromptLockedBy: this._reviewPromptLockedBy,
    };
  }

  toPlainObject(): MistakePatternPlain {
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
      easeFactor: this._easeFactor,
      repetitions: this._repetitions,
      masteryState: this._masteryState,
      dueAt: this._dueAt.toISOString(),
      lastReviewedAt: this._lastReviewedAt?.toISOString() ?? null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      reviewPromptEn: this._reviewPromptEn,
      reviewPromptVi: this._reviewPromptVi,
      reviewRubricVi: this._reviewRubricVi,
      reviewCorrectAnswer: this._reviewCorrectAnswer,
      reviewAcceptableAnswers: this._reviewAcceptableAnswers,
      reviewType: this._reviewType,
      reviewChoices: this._reviewChoices,
      reviewPromptStatus: this._reviewPromptStatus,
      reviewPromptAttempts: this._reviewPromptAttempts,
      reviewPromptError: this._reviewPromptError,
      reviewPromptLockedAt: this._reviewPromptLockedAt?.toISOString() ?? null,
      reviewPromptLockedBy: this._reviewPromptLockedBy,
    };
  }
}

export interface MistakePatternPlain {
  id: string;
  userId: string;
  conceptKey: string;
  normalizedPhrase: string;
  senseKey: string | null;
  category: KeyPhraseCategory;
  errorType: UserErrorType;
  meaningVi: string;
  safeReviewPromptVi: string;
  isSensitive: boolean;
  occurrenceCount: number;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  masteryState: MasteryState;
  dueAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reviewPromptEn: string | null;
  reviewPromptVi: string | null;
  reviewRubricVi: string | null;
  reviewCorrectAnswer: string | null;
  reviewAcceptableAnswers: string[] | null;
  reviewType: string;
  reviewChoices: string[] | null;
  reviewPromptStatus: JobStatus;
  reviewPromptAttempts: number;
  reviewPromptError: string | null;
  reviewPromptLockedAt: string | null;
  reviewPromptLockedBy: string | null;
}
