import { and, eq, sql as drizzleSql, lte, count, desc, asc } from "drizzle-orm";
import { db, schema, sql as rawSql } from "@/db";
import { notifyJobQueued } from "@/lib/jobs/trigger";
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

  async findExercise(
    exerciseId: string,
    userId: string
  ): Promise<Exercise | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.exercises)
      .where(
        and(
          eq(schema.exercises.id, exerciseId),
          eq(schema.exercises.userId, userId)
        )
      )
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

  async findMistakePattern(
    patternId: string,
    userId: string
  ): Promise<MistakePattern | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.mistakePatterns)
      .where(
        and(
          eq(schema.mistakePatterns.id, patternId),
          eq(schema.mistakePatterns.userId, userId)
        )
      )
      .limit(1);
    return row ? MistakePattern.reconstitute(row) : null;
  }

  async findMistakePatternById(
    patternId: string
  ): Promise<MistakePattern | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.mistakePatterns)
      .where(eq(schema.mistakePatterns.id, patternId))
      .limit(1);
    return row ? MistakePattern.reconstitute(row) : null;
  }

  async findPatternByConcept(
    userId: string,
    conceptKey: string,
    errorType: string
  ): Promise<MistakePattern | null> {
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
          repetitions: 0,
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
          easeFactor: row.easeFactor,
          repetitions: row.repetitions,
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

  async findDueMistakePatterns(
    userId: string,
    dueAt: Date,
    limit: number
  ): Promise<MistakePattern[]> {
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

  async getDashboardMetrics(
    userId: string,
    dueAt: Date
  ): Promise<{
    dueCount: number;
    patternCount: number;
    repeatedMistakes: MistakePattern[];
    learningStreakDays: number;
    masteredCount: number;
    reviewSuccessRate: number;
    masteredTrend: Array<{ week: string; cumulative: number }>;
  }> {
    // 1. Fetch Streak dates
    const attemptDates = await this.dbClient
      .selectDistinct({
        activityDate:
          drizzleSql<string>`DATE(${schema.attempts.createdAt} AT TIME ZONE 'UTC')`.as(
            "activity_date"
          ),
      })
      .from(schema.attempts)
      .where(eq(schema.attempts.userId, userId));

    const reviewDates = await this.dbClient
      .selectDistinct({
        activityDate:
          drizzleSql<string>`DATE(${schema.reviewAttempts.createdAt} AT TIME ZONE 'UTC')`.as(
            "activity_date"
          ),
      })
      .from(schema.reviewAttempts)
      .where(eq(schema.reviewAttempts.userId, userId));

    // Merge and deduplicate dates for streak
    const allDateStrings = new Set<string>([
      ...attemptDates.map((r: any) => r.activityDate),
      ...reviewDates.map((r: any) => r.activityDate),
    ]);

    let learningStreakDays = 0;
    if (allDateStrings.size > 0) {
      // Sort descending
      const sortedDates = Array.from(allDateStrings).sort((a, b) =>
        b.localeCompare(a)
      );
      // Compute "today" and "yesterday" in UTC date strings
      const todayStr = new Date().toISOString().slice(0, 10);
      const yesterdayDate = new Date();
      yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
      const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

      // Streak must start from today or yesterday; otherwise streak is 0
      if (sortedDates[0] === todayStr || sortedDates[0] === yesterdayStr) {
        let expectedDate = sortedDates[0];
        for (const dateStr of sortedDates) {
          if (dateStr === expectedDate) {
            learningStreakDays++;
            const d = new Date(expectedDate + "T00:00:00Z");
            d.setUTCDate(d.getUTCDate() - 1);
            expectedDate = d.toISOString().slice(0, 10);
          } else {
            break;
          }
        }
      }
    }

    // 2. Fetch Mastered Count, Due Count, Pattern Count, and Review success rate
    const [
      dueCountResult,
      patternCountResult,
      masteredCountResult,
      repeatedMistakesRows,
      reviewSuccessRateRows,
      masteredTrendRows,
    ] = await Promise.all([
      // dueCount
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
      // patternCount
      this.dbClient
        .select({ value: count() })
        .from(schema.mistakePatterns)
        .where(eq(schema.mistakePatterns.userId, userId)),
      // masteredCount
      this.dbClient
        .select({ value: count() })
        .from(schema.mistakePatterns)
        .where(
          and(
            eq(schema.mistakePatterns.userId, userId),
            eq(schema.mistakePatterns.masteryState, "mastered")
          )
        ),
      // repeatedMistakes
      this.dbClient
        .select()
        .from(schema.mistakePatterns)
        .where(
          and(
            eq(schema.mistakePatterns.userId, userId),
            eq(schema.mistakePatterns.masteryState, "active")
          )
        )
        .orderBy(
          desc(schema.mistakePatterns.occurrenceCount),
          drizzleSql`${schema.mistakePatterns.dueAt} asc`
        )
        .limit(5),
      // reviewSuccessRate
      this.dbClient
        .select({
          total: count(),
          correct: drizzleSql<number>`SUM(CASE WHEN ${schema.reviewAttempts.isCorrect} THEN 1 ELSE 0 END)`,
        })
        .from(schema.reviewAttempts)
        .where(eq(schema.reviewAttempts.userId, userId)),
      // masteredTrend
      this.dbClient
        .select({
          week: drizzleSql<string>`TO_CHAR(DATE_TRUNC('week', ${schema.mistakePatterns.updatedAt}), 'YYYY-MM-DD')`,
        })
        .from(schema.mistakePatterns)
        .where(
          and(
            eq(schema.mistakePatterns.userId, userId),
            eq(schema.mistakePatterns.masteryState, "mastered")
          )
        )
        .orderBy(schema.mistakePatterns.updatedAt),
    ]);

    const reviewSuccessRateTotal = reviewSuccessRateRows[0]?.total ?? 0;
    const reviewSuccessRateCorrect = reviewSuccessRateRows[0]?.correct ?? 0;
    const reviewSuccessRate = reviewSuccessRateTotal
      ? Math.round(
          (Number(reviewSuccessRateCorrect) / Number(reviewSuccessRateTotal)) *
            100
        )
      : 0;

    // Group mastered trend by week and compute cumulative count
    const trend: Array<{ week: string; cumulative: number }> = [];
    if (masteredTrendRows.length > 0) {
      const weekCounts = new Map<string, number>();
      for (const row of masteredTrendRows) {
        weekCounts.set(row.week, (weekCounts.get(row.week) ?? 0) + 1);
      }
      const sortedWeeks = Array.from(weekCounts.keys()).sort();
      let cumulative = 0;
      for (const week of sortedWeeks) {
        cumulative += weekCounts.get(week)!;
        trend.push({ week, cumulative });
      }
    }

    return {
      dueCount: dueCountResult[0]?.value ?? 0,
      patternCount: patternCountResult[0]?.value ?? 0,
      repeatedMistakes: repeatedMistakesRows.map((r: any) =>
        MistakePattern.reconstitute(r)
      ),
      learningStreakDays,
      masteredCount: masteredCountResult[0]?.value ?? 0,
      reviewSuccessRate,
      masteredTrend: trend,
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
