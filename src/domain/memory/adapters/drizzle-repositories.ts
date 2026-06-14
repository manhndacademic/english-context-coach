import { and, eq, sql as drizzleSql, lte, count, desc, asc } from "drizzle-orm";
import { db, schema, sql as rawSql, notifyJobQueued } from "@/db";
import type { Exercise } from "@/domain/lesson/ports";
import type { Attempt, UserError, ReviewAttempt } from "../types";
import { MistakePattern } from "../mistake-pattern";
import type {
  ExerciseRepository,
  AttemptRepository,
  MistakePatternRepository,
  TransactionCoordinator,
} from "../ports";

export class DrizzleExerciseRepository implements ExerciseRepository {
  constructor(private dbClient: any = db) {}

  async findExercise(exerciseId: string, userId: string): Promise<Exercise | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.exercises)
      .where(and(eq(schema.exercises.id, exerciseId), eq(schema.exercises.userId, userId)))
      .limit(1);
    return row ?? null;
  }
}

export class DrizzleAttemptRepository implements AttemptRepository {
  constructor(private dbClient: any = db) {}

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
}

export class DrizzleMistakePatternRepository implements MistakePatternRepository {
  constructor(private dbClient: any = db) {}

  async findMistakePattern(patternId: string, userId: string): Promise<MistakePattern | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.mistakePatterns)
      .where(and(eq(schema.mistakePatterns.id, patternId), eq(schema.mistakePatterns.userId, userId)))
      .limit(1);
    return row ? MistakePattern.reconstitute(row) : null;
  }

  async findMistakePatternById(patternId: string): Promise<MistakePattern | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.mistakePatterns)
      .where(eq(schema.mistakePatterns.id, patternId))
      .limit(1);
    return row ? MistakePattern.reconstitute(row) : null;
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
    return row ? MistakePattern.reconstitute(row) : null;
  }

  async upsertMistakePattern(pattern: MistakePattern): Promise<MistakePattern> {
    const row = pattern.toDbRow();
    const rows = await this.dbClient
      .insert(schema.mistakePatterns)
      .values(row)
      .onConflictDoUpdate({
        target: [
          schema.mistakePatterns.userId,
          schema.mistakePatterns.conceptKey,
          schema.mistakePatterns.errorType,
        ],
        set: {
          occurrenceCount: drizzleSql`${schema.mistakePatterns.occurrenceCount} + 1`,
          intervalDays: 0,
          masteryState: "active",
          dueAt: new Date(),
          updatedAt: new Date(),
          reviewPromptStatus: drizzleSql`case when ${schema.mistakePatterns.reviewPromptEn} is null then 'queued'::job_status else ${schema.mistakePatterns.reviewPromptStatus} end`,
        },
      })
      .returning();
    
    const result = MistakePattern.reconstitute(rows[0]);
    if (rows[0] && rows[0].reviewPromptStatus === "queued") {
      await notifyJobQueued();
    }
    return result;
  }

  async saveMistakePattern(pattern: MistakePattern): Promise<void> {
    const row = pattern.toDbRow();
    await this.dbClient
      .insert(schema.mistakePatterns)
      .values(row)
      .onConflictDoUpdate({
        target: [
          schema.mistakePatterns.userId,
          schema.mistakePatterns.conceptKey,
          schema.mistakePatterns.errorType,
        ],
        set: {
          occurrenceCount: row.occurrenceCount,
          intervalDays: row.intervalDays,
          masteryState: row.masteryState,
          dueAt: row.dueAt,
          lastReviewedAt: row.lastReviewedAt,
          updatedAt: new Date(),
          reviewPromptEn: row.reviewPromptEn,
          reviewPromptVi: row.reviewPromptVi,
          reviewRubricVi: row.reviewRubricVi,
          reviewCorrectAnswer: row.reviewCorrectAnswer,
          reviewAcceptableAnswers: row.reviewAcceptableAnswers,
          reviewPromptStatus: row.reviewPromptStatus,
          reviewPromptAttempts: row.reviewPromptAttempts,
          reviewPromptError: row.reviewPromptError,
          reviewPromptLockedAt: row.reviewPromptLockedAt,
          reviewPromptLockedBy: row.reviewPromptLockedBy,
        },
      });
    if (row.reviewPromptStatus === "queued") {
      await notifyJobQueued();
    }
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
        mastery_state as "masteryState",
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
    return pattern ? MistakePattern.reconstitute(pattern) : null;
  }

  async findDueMistakePatterns(userId: string, dueAt: Date, limit: number): Promise<MistakePattern[]> {
    const rows = await this.dbClient
      .select()
      .from(schema.mistakePatterns)
      .where(
        and(
          eq(schema.mistakePatterns.userId, userId),
          eq(schema.mistakePatterns.masteryState, "active"),
          lte(schema.mistakePatterns.dueAt, dueAt),
          eq(schema.mistakePatterns.reviewPromptStatus, "succeeded")
        )
      )
      .orderBy(asc(schema.mistakePatterns.dueAt))
      .limit(limit);
    return rows.map((r: any) => MistakePattern.reconstitute(r));
  }

  async getDashboardMetrics(userId: string, dueAt: Date): Promise<{
    dueCount: number;
    patternCount: number;
    repeatedMistakes: MistakePattern[];
  }> {
    const [dueCountResult, patternCountResult, repeatedMistakesRows] = await Promise.all([
      this.dbClient
        .select({ value: count() })
        .from(schema.mistakePatterns)
        .where(
          and(
            eq(schema.mistakePatterns.userId, userId),
            eq(schema.mistakePatterns.masteryState, "active"),
            lte(schema.mistakePatterns.dueAt, dueAt),
            eq(schema.mistakePatterns.reviewPromptStatus, "succeeded")
          )
        ),
      this.dbClient
        .select({ value: count() })
        .from(schema.mistakePatterns)
        .where(eq(schema.mistakePatterns.userId, userId)),
      this.dbClient
        .select()
        .from(schema.mistakePatterns)
        .where(and(eq(schema.mistakePatterns.userId, userId), eq(schema.mistakePatterns.masteryState, "active")))
        .orderBy(desc(schema.mistakePatterns.occurrenceCount), drizzleSql`${schema.mistakePatterns.dueAt} asc`)
        .limit(5),
    ]);

    return {
      dueCount: dueCountResult[0]?.value ?? 0,
      patternCount: patternCountResult[0]?.value ?? 0,
      repeatedMistakes: repeatedMistakesRows.map((r: any) => MistakePattern.reconstitute(r)),
    };
  }
}

export class DrizzleTransactionCoordinator implements TransactionCoordinator {
  constructor(private dbClient: any = db) {}

  async runInTransaction<T>(
    operation: (repos: {
      exercises: ExerciseRepository;
      attempts: AttemptRepository;
      mistakePatterns: MistakePatternRepository;
    }) => Promise<T>
  ): Promise<T> {
    if (typeof this.dbClient.transaction === "function") {
      return await this.dbClient.transaction(async (txClient: any) => {
        return await operation({
          exercises: new DrizzleExerciseRepository(txClient),
          attempts: new DrizzleAttemptRepository(txClient),
          mistakePatterns: new DrizzleMistakePatternRepository(txClient),
        });
      });
    }
    return await operation({
      exercises: new DrizzleExerciseRepository(this.dbClient),
      attempts: new DrizzleAttemptRepository(this.dbClient),
      mistakePatterns: new DrizzleMistakePatternRepository(this.dbClient),
    });
  }
}
