import {
  and,
  eq,
  sql as drizzleSql,
  lte,
  count,
  desc,
  asc,
  inArray,
} from "drizzle-orm";
import { db, schema, sql as rawSql, type DbClient, type DrizzleTx } from "@/db";
import type { Attempt, UserError, ReviewAttempt } from "../types";
import { MistakePattern } from "../mistake-pattern";
import { PhrasePractice } from "../phrase-practice";
import type {
  ExerciseRepository,
  AttemptRepository,
  MistakePatternRepository,
  PhrasePracticeRepository,
  TransactionCoordinator,
  GradableExercise,
  MemoryKeyPhraseInput,
  PracticeHistoryRepository,
  MemoryLessonLookup,
} from "../ports";

export class DrizzleExerciseRepository implements ExerciseRepository {
  constructor(private dbClient: DbClient = db) {}

  async findExercise(
    exerciseId: string,
    userId: string
  ): Promise<
    | (GradableExercise & {
        id: string;
        lessonId: string;
        userId: string;
        keyPhraseId: string | null;
        lessonFocusId: string | null;
        orderIndex: number;
        createdAt: Date;
      })
    | null
  > {
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
    return (row as any) ?? null;
  }
}

export class DrizzleAttemptRepository implements AttemptRepository {
  constructor(private dbClient: DbClient = db) {}

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

  async createPhrasePracticeAttempt(attempt: {
    userId: string;
    phrasePracticeId: string;
    answer: string;
    score: number;
    isCorrect: boolean;
    feedbackVi: string;
  }) {
    const [row] = await this.dbClient
      .insert(schema.phrasePracticeAttempts)
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
      .values({
        ...error,
        errorType:
          error.errorType as (typeof schema.errorTypeEnum.enumValues)[number],
      })
      .returning();
    return row;
  }
}

export class DrizzleMistakePatternRepository implements MistakePatternRepository {
  constructor(private dbClient: DbClient = db) {}

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
          eq(
            schema.mistakePatterns.errorType,
            errorType as (typeof schema.errorTypeEnum.enumValues)[number]
          )
        )
      )
      .limit(1);
    return row ? MistakePattern.reconstitute(row) : null;
  }

  async upsertMistakePattern(pattern: MistakePattern): Promise<MistakePattern> {
    const row = pattern.toDbRow();
    const rows = await this.dbClient
      .insert(schema.mistakePatterns)
      .values(row as typeof schema.mistakePatterns.$inferInsert)
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
    return result;
  }

  async saveMistakePattern(pattern: MistakePattern): Promise<void> {
    const row = pattern.toDbRow();
    await this.dbClient
      .insert(schema.mistakePatterns)
      .values(row as typeof schema.mistakePatterns.$inferInsert)
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
  }

  async claimReviewPromptJob(workerId: string): Promise<MistakePattern | null> {
    const rows = (await rawSql`
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
    `) as unknown as Array<typeof schema.mistakePatterns.$inferSelect>;
    const pattern = rows[0];
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
    return rows.map((r) => MistakePattern.reconstitute(r));
  }

  async findAllMistakePatterns(userId: string): Promise<MistakePattern[]> {
    const rows = await this.dbClient
      .select()
      .from(schema.mistakePatterns)
      .where(eq(schema.mistakePatterns.userId, userId))
      .orderBy(desc(schema.mistakePatterns.updatedAt));
    return rows.map((r) => MistakePattern.reconstitute(r));
  }

  async bulkCreateFromKeyPhrases(
    userId: string,
    phrases: MemoryKeyPhraseInput[]
  ): Promise<{ inserted: number; skipped: number }> {
    if (phrases.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    const values = phrases.map((phrase) => ({
      userId,
      source: "phrase" as const,
      keyPhraseId: phrase.id,
      conceptKey: phrase.conceptKey,
      normalizedPhrase: phrase.normalizedPhrase,
      senseKey: phrase.senseKey,
      category: phrase.category,
      errorType: "phrase_misunderstanding" as const,
      meaningVi: phrase.conceptMeaningVi,
      safeReviewPromptVi: phrase.conceptMeaningVi,
      isSensitive: phrase.isSensitive,
      reviewPromptStatus: "queued" as const,
    }));

    const insertedRows = await this.dbClient
      .insert(schema.mistakePatterns)
      .values(values)
      .onConflictDoNothing({
        target: [
          schema.mistakePatterns.userId,
          schema.mistakePatterns.conceptKey,
          schema.mistakePatterns.errorType,
        ],
      })
      .returning({ id: schema.mistakePatterns.id });

    return {
      inserted: insertedRows.length,
      skipped: phrases.length - insertedRows.length,
    };
  }

  async scrubSensitiveContentForSourceText(
    userId: string,
    sourceTextId: string
  ): Promise<void> {
    const lessonRows = await this.dbClient
      .select({ id: schema.lessons.id })
      .from(schema.lessons)
      .where(
        and(
          eq(schema.lessons.userId, userId),
          eq(schema.lessons.sourceTextId, sourceTextId)
        )
      );

    if (lessonRows.length === 0) {
      return;
    }

    const lessonIds = lessonRows.map((lesson) => lesson.id);
    const keyPhraseRows = await this.dbClient
      .select({ id: schema.keyPhrases.id })
      .from(schema.keyPhrases)
      .where(inArray(schema.keyPhrases.lessonId, lessonIds));

    if (keyPhraseRows.length === 0) {
      return;
    }

    const keyPhraseIds = keyPhraseRows.map((phrase) => phrase.id);
    await this.dbClient
      .delete(schema.mistakePatterns)
      .where(
        and(
          eq(schema.mistakePatterns.userId, userId),
          inArray(schema.mistakePatterns.keyPhraseId, keyPhraseIds)
        )
      );
  }

  async getLessonsForPatterns(
    userId: string
  ): Promise<Record<string, Array<{ id: string; title: string | null }>>> {
    const rows = await this.dbClient
      .select({
        conceptKey: schema.userErrors.conceptKey,
        errorType: schema.userErrors.errorType,
        lessonId: schema.lessons.id,
        lessonTitle: schema.lessons.title,
      })
      .from(schema.userErrors)
      .innerJoin(
        schema.lessons,
        eq(schema.userErrors.lessonId, schema.lessons.id)
      )
      .where(eq(schema.userErrors.userId, userId));

    const map: Record<string, Array<{ id: string; title: string | null }>> = {};
    for (const row of rows) {
      if (!row.lessonId) continue;
      const key = `${row.conceptKey}_${row.errorType}`;
      const lessons = map[key] ?? [];
      if (!lessons.some((lesson) => lesson.id === row.lessonId)) {
        lessons.push({ id: row.lessonId, title: row.lessonTitle });
      }
      map[key] = lessons;
    }

    return map;
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
    exercisesCompleted: number;
    lessonsCompleted: number;
    literalErrorTrend: Array<{
      week: string;
      literalRatio: number;
      total: number;
    }>;
  }> {
    // 1. Fetch Streak dates
    const attemptDates = await this.dbClient
      .selectDistinct({
        activityDate:
          drizzleSql<string>`DATE(${schema.attempts.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')`.as(
            "activity_date"
          ),
      })
      .from(schema.attempts)
      .where(eq(schema.attempts.userId, userId));

    const reviewDates = await this.dbClient
      .selectDistinct({
        activityDate:
          drizzleSql<string>`DATE(${schema.reviewAttempts.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')`.as(
            "activity_date"
          ),
      })
      .from(schema.reviewAttempts)
      .where(eq(schema.reviewAttempts.userId, userId));

    // Merge and deduplicate dates for streak
    const allDateStrings = new Set<string>([
      ...attemptDates.map((r) => r.activityDate),
      ...reviewDates.map((r) => r.activityDate),
    ]);

    let learningStreakDays = 0;
    if (allDateStrings.size > 0) {
      // Sort descending
      const sortedDates = Array.from(allDateStrings).sort((a, b) =>
        b.localeCompare(a)
      );
      // Compute "today" and "yesterday" in Vietnam date strings relative to dueAt
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const todayStr = formatter.format(dueAt);
      const yesterday = new Date(dueAt.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = formatter.format(yesterday);

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
      exercisesCompletedResult,
      lessonsCompletedResult,
      literalErrorTrendRows,
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
          week: drizzleSql<string>`TO_CHAR(DATE_TRUNC('week', ${schema.mistakePatterns.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD')`,
        })
        .from(schema.mistakePatterns)
        .where(
          and(
            eq(schema.mistakePatterns.userId, userId),
            eq(schema.mistakePatterns.masteryState, "mastered")
          )
        )
        .orderBy(schema.mistakePatterns.updatedAt),
      // exercisesCompleted
      this.dbClient
        .select({ value: count() })
        .from(schema.attempts)
        .where(
          and(
            eq(schema.attempts.userId, userId),
            eq(schema.attempts.isCorrect, true)
          )
        ),
      // lessonsCompleted
      this.dbClient
        .select({
          value: drizzleSql<number>`COUNT(DISTINCT ${schema.attempts.lessonId})`,
        })
        .from(schema.attempts)
        .where(eq(schema.attempts.userId, userId)),
      // literalErrorTrend
      this.dbClient
        .select({
          week: drizzleSql<string>`TO_CHAR(DATE_TRUNC('week', ${schema.userErrors.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD')`,
          total: count(),
          literalCount: drizzleSql<number>`SUM(CASE WHEN ${schema.userErrors.errorType} = 'literal_translation' THEN 1 ELSE 0 END)`,
        })
        .from(schema.userErrors)
        .where(eq(schema.userErrors.userId, userId))
        .groupBy(
          drizzleSql`DATE_TRUNC('week', ${schema.userErrors.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')`
        )
        .orderBy(
          drizzleSql`DATE_TRUNC('week', ${schema.userErrors.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')`
        ),
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

    const literalErrorTrend = (literalErrorTrendRows || []).map((row) => {
      const total = Number(row.total) || 0;
      const literalCount = Number(row.literalCount) || 0;
      const literalRatio =
        total > 0 ? Math.round((literalCount / total) * 100) : 0;
      return {
        week: row.week ?? "",
        literalRatio,
        total,
      };
    });

    return {
      dueCount: dueCountResult[0]?.value ?? 0,
      patternCount: patternCountResult[0]?.value ?? 0,
      repeatedMistakes: repeatedMistakesRows.map((r) =>
        MistakePattern.reconstitute(r)
      ),
      learningStreakDays,
      masteredCount: masteredCountResult[0]?.value ?? 0,
      reviewSuccessRate,
      masteredTrend: trend,
      exercisesCompleted: exercisesCompletedResult[0]?.value ?? 0,
      lessonsCompleted: Number(lessonsCompletedResult[0]?.value) ?? 0,
      literalErrorTrend,
    };
  }
}

export class DrizzleTransactionCoordinator implements TransactionCoordinator {
  constructor(private dbClient: DbClient = db) {}

  async runInTransaction<T>(
    operation: (repos: {
      exercises: ExerciseRepository;
      attempts: AttemptRepository;
      mistakePatterns: MistakePatternRepository;
      phrasePractices: PhrasePracticeRepository;
    }) => Promise<T>
  ): Promise<T> {
    if (typeof this.dbClient.transaction === "function") {
      return await this.dbClient.transaction(async (txClient: DrizzleTx) => {
        return await operation({
          exercises: new DrizzleExerciseRepository(txClient),
          attempts: new DrizzleAttemptRepository(txClient),
          mistakePatterns: new DrizzleMistakePatternRepository(txClient),
          phrasePractices: new DrizzlePhrasePracticeRepository(txClient),
        });
      });
    }
    return await operation({
      exercises: new DrizzleExerciseRepository(this.dbClient),
      attempts: new DrizzleAttemptRepository(this.dbClient),
      mistakePatterns: new DrizzleMistakePatternRepository(this.dbClient),
      phrasePractices: new DrizzlePhrasePracticeRepository(this.dbClient),
    });
  }
}

export class DrizzlePracticeHistoryRepository implements PracticeHistoryRepository {
  constructor(private dbClient: DbClient = db) {}

  async getLessonPracticeState(
    lessonId: string,
    userId: string
  ): Promise<{
    attempts: Attempt[];
    userErrors: UserError[];
    mistakePatterns: MistakePattern[];
  }> {
    const [attempts, userErrors] = await Promise.all([
      this.dbClient
        .select()
        .from(schema.attempts)
        .where(eq(schema.attempts.lessonId, lessonId))
        .orderBy(desc(schema.attempts.createdAt)),
      this.dbClient
        .select()
        .from(schema.userErrors)
        .where(eq(schema.userErrors.lessonId, lessonId)),
    ]);

    const conceptKeys: string[] = Array.from(
      new Set(
        userErrors.map((error: { conceptKey: string }) => error.conceptKey)
      )
    );
    const mistakePatterns = conceptKeys.length
      ? await this.dbClient
          .select()
          .from(schema.mistakePatterns)
          .where(
            and(
              eq(schema.mistakePatterns.userId, userId),
              inArray(schema.mistakePatterns.conceptKey, conceptKeys)
            )
          )
      : [];

    return {
      attempts: attempts as Attempt[],
      userErrors: userErrors as UserError[],
      mistakePatterns: mistakePatterns.map((r) =>
        MistakePattern.reconstitute(r)
      ),
    };
  }
}

export class DrizzlePhrasePracticeRepository implements PhrasePracticeRepository {
  constructor(private dbClient: DbClient = db) {}

  async findPhrasePractice(
    practiceId: string,
    userId: string
  ): Promise<PhrasePractice | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.phrasePractices)
      .where(
        and(
          eq(schema.phrasePractices.id, practiceId),
          eq(schema.phrasePractices.userId, userId)
        )
      )
      .limit(1);
    return row ? PhrasePractice.reconstitute(row) : null;
  }

  async findPhrasePracticeById(
    practiceId: string
  ): Promise<PhrasePractice | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.phrasePractices)
      .where(eq(schema.phrasePractices.id, practiceId))
      .limit(1);
    return row ? PhrasePractice.reconstitute(row) : null;
  }

  async findPracticeByConcept(
    userId: string,
    conceptKey: string
  ): Promise<PhrasePractice | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.phrasePractices)
      .where(
        and(
          eq(schema.phrasePractices.userId, userId),
          eq(schema.phrasePractices.conceptKey, conceptKey)
        )
      )
      .limit(1);
    return row ? PhrasePractice.reconstitute(row) : null;
  }

  async upsertPhrasePractice(
    practice: PhrasePractice
  ): Promise<PhrasePractice> {
    const row = practice.toDbRow();
    const rows = await this.dbClient
      .insert(schema.phrasePractices)
      .values(row as typeof schema.phrasePractices.$inferInsert)
      .onConflictDoUpdate({
        target: [
          schema.phrasePractices.userId,
          schema.phrasePractices.conceptKey,
        ],
        set: {
          intervalDays: 0,
          repetitions: 0,
          masteryState: "active",
          dueAt: new Date(),
          updatedAt: new Date(),
          reviewPromptStatus: drizzleSql`case when ${schema.phrasePractices.reviewPromptEn} is null then 'queued'::job_status else ${schema.phrasePractices.reviewPromptStatus} end`,
        },
      })
      .returning();

    const result = PhrasePractice.reconstitute(rows[0]);
    return result;
  }

  async savePhrasePractice(practice: PhrasePractice): Promise<void> {
    const row = practice.toDbRow();
    await this.dbClient
      .insert(schema.phrasePractices)
      .values(row as typeof schema.phrasePractices.$inferInsert)
      .onConflictDoUpdate({
        target: [
          schema.phrasePractices.userId,
          schema.phrasePractices.conceptKey,
        ],
        set: {
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
  }

  async claimReviewPromptJob(workerId: string): Promise<PhrasePractice | null> {
    const rows = (await rawSql`
      update phrase_practices
      set review_prompt_status = 'running',
          review_prompt_locked_at = now(),
          review_prompt_locked_by = ${workerId},
          review_prompt_attempts = review_prompt_attempts + 1,
          updated_at = now()
      where id = (
        select id
        from phrase_practices
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
        meaning_vi as "meaningVi",
        safe_review_prompt_vi as "safeReviewPromptVi",
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
    `) as unknown as Array<typeof schema.phrasePractices.$inferSelect>;
    const practice = rows[0];
    return practice ? PhrasePractice.reconstitute(practice) : null;
  }

  async findDuePhrasePractices(
    userId: string,
    dueAt: Date,
    limit: number
  ): Promise<PhrasePractice[]> {
    const rows = await this.dbClient
      .select()
      .from(schema.phrasePractices)
      .where(
        and(
          eq(schema.phrasePractices.userId, userId),
          eq(schema.phrasePractices.masteryState, "active"),
          lte(schema.phrasePractices.dueAt, dueAt),
          eq(schema.phrasePractices.reviewPromptStatus, "succeeded")
        )
      )
      .orderBy(asc(schema.phrasePractices.dueAt))
      .limit(limit);
    return rows.map((r) => PhrasePractice.reconstitute(r));
  }

  async findAllPhrasePractices(userId: string): Promise<PhrasePractice[]> {
    const rows = await this.dbClient
      .select()
      .from(schema.phrasePractices)
      .where(eq(schema.phrasePractices.userId, userId))
      .orderBy(desc(schema.phrasePractices.updatedAt));
    return rows.map((r) => PhrasePractice.reconstitute(r));
  }

  async bulkCreateFromKeyPhrases(
    userId: string,
    phrases: MemoryKeyPhraseInput[]
  ): Promise<{ inserted: number; skipped: number }> {
    if (phrases.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    const values = phrases.map((phrase) => ({
      userId,
      source: "phrase" as const,
      keyPhraseId: phrase.id,
      conceptKey: phrase.conceptKey,
      normalizedPhrase: phrase.normalizedPhrase,
      senseKey: phrase.senseKey,
      category: phrase.category,
      meaningVi: phrase.conceptMeaningVi,
      safeReviewPromptVi: phrase.conceptMeaningVi,
      isSensitive: phrase.isSensitive,
      reviewPromptStatus: "queued" as const,
    }));

    const insertedRows = await this.dbClient
      .insert(schema.phrasePractices)
      .values(values)
      .onConflictDoNothing({
        target: [
          schema.phrasePractices.userId,
          schema.phrasePractices.conceptKey,
        ],
      })
      .returning({ id: schema.phrasePractices.id });

    return {
      inserted: insertedRows.length,
      skipped: phrases.length - insertedRows.length,
    };
  }
}

export class DrizzleMemoryLessonLookup implements MemoryLessonLookup {
  constructor(private dbClient: DbClient = db) {}

  async findKeyPhrase(keyPhraseId: string) {
    const [row] = await this.dbClient
      .select()
      .from(schema.keyPhrases)
      .where(eq(schema.keyPhrases.id, keyPhraseId))
      .limit(1);
    return row ? (row as any) : null;
  }

  async findLessonFocus(lessonFocusId: string) {
    const [row] = await this.dbClient
      .select()
      .from(schema.lessonFocuses)
      .where(eq(schema.lessonFocuses.id, lessonFocusId))
      .limit(1);
    return row ? (row as any) : null;
  }
}
