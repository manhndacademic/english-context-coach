import type { Exercise, KeyPhrase, LessonFocus } from "@/domain/lesson";
import type { Attempt, UserError } from "./types";
import type { MistakePattern } from "./mistake-pattern";

export interface ExercisePracticeData {
  exercise: Exercise;
  attempts: Attempt[];
  keyPhrase?: KeyPhrase;
  lessonFocus?: LessonFocus;
  userError?: UserError;
  mistakePattern?: MistakePattern;
}

export class ExercisePractice {
  public readonly exercise: Exercise;
  public readonly attempts: Attempt[];
  public readonly keyPhrase?: KeyPhrase;
  public readonly lessonFocus?: LessonFocus;
  public readonly userError?: UserError;
  public readonly mistakePattern?: MistakePattern;

  constructor(data: ExercisePracticeData) {
    this.exercise = data.exercise;
    this.attempts = data.attempts;
    this.keyPhrase = data.keyPhrase;
    this.lessonFocus = data.lessonFocus;
    this.userError = data.userError;
    this.mistakePattern = data.mistakePattern;
  }

  get isSolved(): boolean {
    return Boolean(this.attempts[0]?.isCorrect);
  }

  get needsRetry(): boolean {
    return Boolean(this.attempts[0] && !this.attempts[0].isCorrect);
  }

  get latestAttempt(): Attempt | undefined {
    return this.attempts[0];
  }
}
