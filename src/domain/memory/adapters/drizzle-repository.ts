import { and, eq, sql, lte, count, desc, asc } from "drizzle-orm";
import { db, schema, sql as rawSql } from "@/db";
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
        reviewPromptStatus: "queued",
        reviewPromptAttempts: 0,
      })
      .onConflictDoUpdate({
        target: [
          schema.mistakePatterns.userId,
          schema.mistakePatterns.conceptKey,
          schema.mistakePatterns.errorType,
        ],
        set: {
          occurrenceCount: sql`${schema.mistakePatterns.occurrenceCount} + 1`,
          intervalDays: 0,
          dueAt: new Date(),
          updatedAt: new Date(),
          reviewPromptStatus: sql`case when ${schema.mistakePatterns.reviewPromptEn} is null then 'queued'::job_status else ${schema.mistakePatterns.reviewPromptStatus} end`,
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

  async claimReviewPromptJob(workerId: string): Promise<MistakePattern | null> {
    const rows = await rawSql`
      update mistake_patterns
      set review_prompt_status = 'running',
          review_prompt_locked_at = now(),
          review_prompt_locked_by = ${workerId},
          review_prompt_attempts = review_prompt_attempts + 1,
          updated_at = now()
      where id = (
        select id
        from mistake_patterns
        where review_prompt_status = 'queued'
           or (review_prompt_status = 'running' and review_prompt_locked_at < now() - interval '10 minutes')
        order by created_at asc
        for update skip locked
        limit 1
      )
      returning
        id,
        user_id as "userId",
        concept_key as "conceptKey",
        normalized_phrase as "normalizedPhrase",
        sense_key as "senseKey",
        category,
        error_type as "errorType",
        meaning_vi as "meaningVi",
        safe_review_prompt_vi as "safeReviewPromptVi",
        occurrence_count as "occurrenceCount",
        interval_days as "intervalDays",
        due_at as "dueAt",
        last_reviewed_at as "lastReviewedAt",
        is_sensitive as "isSensitive",
        created_at as "createdAt",
        updated_at as "updatedAt",
        review_prompt_en as "reviewPromptEn",
        review_prompt_vi as "reviewPromptVi",
        review_rubric_vi as "reviewRubricVi",
        review_correct_answer as "reviewCorrectAnswer",
        review_acceptable_answers as "reviewAcceptableAnswers",
        review_prompt_status as "reviewPromptStatus",
        review_prompt_attempts as "reviewPromptAttempts",
        review_prompt_error as "reviewPromptError",
        review_prompt_locked_at as "reviewPromptLockedAt",
        review_prompt_locked_by as "reviewPromptLockedBy"
    `;
    const pattern = rows[0] as any;
    return pattern ?? null;
  }

  async updateReviewPromptJobStatus(
    patternId: string,
    status: "queued" | "running" | "succeeded" | "failed",
    extra?: Partial<MistakePattern>
  ): Promise<void> {
    const updates: any = {
      reviewPromptStatus: status,
      updatedAt: new Date(),
    };

    if (extra) {
      if (extra.reviewPromptError !== undefined) updates.reviewPromptError = extra.reviewPromptError;
      if (extra.reviewPromptAttempts !== undefined) updates.reviewPromptAttempts = extra.reviewPromptAttempts;
      if (extra.reviewPromptLockedAt !== undefined) updates.reviewPromptLockedAt = extra.reviewPromptLockedAt;
      if (extra.reviewPromptLockedBy !== undefined) updates.reviewPromptLockedBy = extra.reviewPromptLockedBy;
      
      if (extra.reviewPromptEn !== undefined) updates.reviewPromptEn = extra.reviewPromptEn;
      if (extra.reviewPromptVi !== undefined) updates.reviewPromptVi = extra.reviewPromptVi;
      if (extra.reviewRubricVi !== undefined) updates.reviewRubricVi = extra.reviewRubricVi;
      if (extra.reviewCorrectAnswer !== undefined) updates.reviewCorrectAnswer = extra.reviewCorrectAnswer;
      if (extra.reviewAcceptableAnswers !== undefined) updates.reviewAcceptableAnswers = extra.reviewAcceptableAnswers;
    }

    await this.dbClient
      .update(schema.mistakePatterns)
      .set(updates)
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
