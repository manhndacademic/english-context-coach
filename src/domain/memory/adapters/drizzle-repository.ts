import { and, eq, sql, lte, count, desc, asc } from "drizzle-orm";
import { db, schema } from "@/db";
import type { LearnerMemoryRepository } from "../ports";
import type { Exercise, KeyPhrase, LessonFocus } from "@/domain/lesson/ports";
import type { Attempt, UserError, MistakePattern, ReviewAttempt } from "../types";
import type {
  Exercise as DbExercise,
  Attempt as DbAttempt,
  UserError as DbUserError,
  MistakePattern as DbMistakePattern,
  ReviewAttempt as DbReviewAttempt,
  KeyPhrase as DbKeyPhrase,
  LessonFocus as DbLessonFocus,
} from "@/db/schema";

export class DrizzleLearnerMemoryRepository implements LearnerMemoryRepository {
  constructor(private dbClient: any = db) {}

  async findExercise(exerciseId: string, userId: string): Promise<Exercise | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.exercises)
      .where(and(eq(schema.exercises.id, exerciseId), eq(schema.exercises.userId, userId)))
      .limit(1);
    return row ?? null;
  }

  async findMistakePattern(patternId: string, userId: string): Promise<MistakePattern | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.mistakePatterns)
      .where(and(eq(schema.mistakePatterns.id, patternId), eq(schema.mistakePatterns.userId, userId)))
      .limit(1);
    return row ?? null;
  }

  async findPatternByConcept(userId: string, conceptKey: string, errorType: string): Promise<MistakePattern | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.mistakePatterns)
      .where(
        and(
          eq(schema.mistakePatterns.userId, userId),
          eq(schema.mistakePatterns.conceptKey, conceptKey),
          eq(schema.mistakePatterns.errorType, errorType as any)
        )
      )
      .limit(1);
    return row ?? null;
  }

  async findKeyPhrase(keyPhraseId: string): Promise<KeyPhrase | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.keyPhrases)
      .where(eq(schema.keyPhrases.id, keyPhraseId))
      .limit(1);
    return row ?? null;
  }

  async findLessonFocus(lessonFocusId: string): Promise<LessonFocus | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.lessonFocuses)
      .where(eq(schema.lessonFocuses.id, lessonFocusId))
      .limit(1);
    return row ?? null;
  }

  async runInTransaction<T>(operation: (tx: LearnerMemoryRepository) => Promise<T>): Promise<T> {
    // If the dbClient has a transaction function, run inside transaction
    if (typeof this.dbClient.transaction === "function") {
      return await this.dbClient.transaction(async (drizzleTx: any) => {
        const txRepo = new DrizzleLearnerMemoryRepository(drizzleTx);
        return await operation(txRepo);
      });
    }
    // If it's already inside a transaction, just execute operation
    return await operation(this);
  }

  async createAttempt(attempt: {
    exerciseId: string;
    lessonId: string;
    userId: string;
    answer: string;
    score: number;
    isCorrect: boolean;
    feedbackVi: string;
    gradingMetadata: any;
  }): Promise<Attempt> {
    const [row] = await this.dbClient
      .insert(schema.attempts)
      .values(attempt)
      .returning();
    return row;
  }

  async createUserError(error: {
    userId: string;
    attemptId: string;
    lessonId: string;
    keyPhraseId: string | null;
    lessonFocusId: string | null;
    errorType: string;
    conceptKey: string;
    normalizedPhrase: string;
    senseKey: string;
    explanationVi: string;
    isSourceSensitive: boolean;
    isRepeated: boolean;
  }): Promise<UserError> {
    const [row] = await this.dbClient
      .insert(schema.userErrors)
      .values(error as any)
      .returning();
    return row;
  }

  async upsertMistakePattern(input: {
    userId: string;
    conceptKey: string;
    normalizedPhrase: string;
    senseKey: string | null;
    category: "idiom" | "phrasal_verb" | "technical_term" | "collocation" | "grammar_pattern" | "business_phrase" | "general_phrase";
    errorType: "literal_translation" | "phrase_misunderstanding" | "technical_term_misunderstanding" | "phrasal_verb_error" | "collocation_error" | "grammar_structure_misread" | "pronoun_reference_misread" | "tone_register_misread" | "missing_context";
    meaningVi: string;
    safeReviewPromptVi: string;
    isSensitive: boolean;
  }): Promise<MistakePattern> {
    const rows = await this.dbClient
      .insert(schema.mistakePatterns)
      .values({
        userId: input.userId,
        conceptKey: input.conceptKey,
        normalizedPhrase: input.normalizedPhrase,
        senseKey: input.senseKey,
        category: input.category,
        errorType: input.errorType,
        meaningVi: input.meaningVi,
        safeReviewPromptVi: input.safeReviewPromptVi,
        occurrenceCount: 1,
        intervalDays: 0,
        dueAt: new Date(),
        isSensitive: input.isSensitive,
      })
      .onConflictDoUpdate({
        target: [
          schema.mistakePatterns.userId,
          schema.mistakePatterns.conceptKey,
          schema.mistakePatterns.errorType,
        ],
        set: {
          occurrenceCount: sql`${schema.mistakePatterns.occurrenceCount} + 1`,
          dueAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows[0];
  }

  async updateMistakePatternSchedule(
    patternId: string,
    updates: {
      intervalDays: number;
      dueAt: Date;
      lastReviewedAt?: Date;
    }
  ): Promise<void> {
    await this.dbClient
      .update(schema.mistakePatterns)
      .set({
        intervalDays: updates.intervalDays,
        dueAt: updates.dueAt,
        lastReviewedAt: updates.lastReviewedAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.mistakePatterns.id, patternId));
  }

  async createReviewAttempt(attempt: {
    userId: string;
    mistakePatternId: string;
    answer: string;
    score: number;
    isCorrect: boolean;
    feedbackVi: string;
  }): Promise<ReviewAttempt> {
    const [row] = await this.dbClient
      .insert(schema.reviewAttempts)
      .values(attempt)
      .returning();
    return row;
  }

  async findDueMistakePatterns(userId: string, dueAt: Date, limit: number): Promise<MistakePattern[]> {
    return await this.dbClient
      .select()
      .from(schema.mistakePatterns)
      .where(and(eq(schema.mistakePatterns.userId, userId), lte(schema.mistakePatterns.dueAt, dueAt)))
      .orderBy(asc(schema.mistakePatterns.dueAt))
      .limit(limit);
  }

  async getDashboardMetrics(userId: string, dueAt: Date): Promise<{
    dueCount: number;
    patternCount: number;
    repeatedMistakes: MistakePattern[];
  }> {
    const [dueCountResult, patternCountResult, repeatedMistakes] = await Promise.all([
      this.dbClient
        .select({ value: count() })
        .from(schema.mistakePatterns)
        .where(and(eq(schema.mistakePatterns.userId, userId), lte(schema.mistakePatterns.dueAt, dueAt))),
      this.dbClient
        .select({ value: count() })
        .from(schema.mistakePatterns)
        .where(eq(schema.mistakePatterns.userId, userId)),
      this.dbClient
        .select()
        .from(schema.mistakePatterns)
        .where(eq(schema.mistakePatterns.userId, userId))
        .orderBy(desc(schema.mistakePatterns.occurrenceCount), sql`${schema.mistakePatterns.dueAt} asc`)
        .limit(5),
    ]);

    return {
      dueCount: dueCountResult[0]?.value ?? 0,
      patternCount: patternCountResult[0]?.value ?? 0,
      repeatedMistakes,
    };
  }

  async findMistakePatternById(patternId: string): Promise<MistakePattern | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.mistakePatterns)
      .where(eq(schema.mistakePatterns.id, patternId))
      .limit(1);
    return row ?? null;
  }

  async updateMistakePatternReviewPrompt(
    patternId: string,
    prompts: {
      reviewPromptEn: string;
      reviewPromptVi: string;
      reviewRubricVi: string;
      reviewCorrectAnswer: string;
      reviewAcceptableAnswers: string[];
    }
  ): Promise<void> {
    await this.dbClient
      .update(schema.mistakePatterns)
      .set({
        reviewPromptEn: prompts.reviewPromptEn,
        reviewPromptVi: prompts.reviewPromptVi,
        reviewRubricVi: prompts.reviewRubricVi,
        reviewCorrectAnswer: prompts.reviewCorrectAnswer,
        reviewAcceptableAnswers: prompts.reviewAcceptableAnswers,
        updatedAt: new Date(),
      })
      .where(eq(schema.mistakePatterns.id, patternId));
  }
}
