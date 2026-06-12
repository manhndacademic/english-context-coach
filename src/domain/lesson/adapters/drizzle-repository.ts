import { and, asc, count, desc, eq, gt, inArray, sql as drizzleSql, type SQL } from "drizzle-orm";
import { db, schema, sql as rawSql } from "@/db";
import { PROMPT_VERSIONS } from "@/domain/constants";
import { getTextProcessor, type TextProcessor } from "@/domain/text";
import {
  sanitizeGenerationThought,
  selectDisplayGenerationJob,
  type GenerationMilestoneCode,
  type GenerationStage,
} from "@/domain/generation-progress";
import type {
  LessonRepository,
  LessonAggregate,
  Lesson,
  SourceText,
  KeyPhrase,
  SentenceBreakdown,
  LessonFocus,
  Exercise,
  GenerationJob,
  GenerationMilestone,
  GenerationThought,
} from "../ports";
import type {
  SourceText as DbSourceText,
  Lesson as DbLesson,
  KeyPhrase as DbKeyPhrase,
  SentenceBreakdown as DbSentenceBreakdown,
  LessonFocus as DbLessonFocus,
  Exercise as DbExercise,
  Attempt as DbAttempt,
  UserError as DbUserError,
  GenerationJob as DbGenerationJob,
  GenerationMilestone as DbGenerationMilestone,
  GenerationThought as DbGenerationThought,
} from "@/db/schema";
import type { AnalysisResult, ExercisesResult } from "@/lib/ai/schemas";

export class DrizzleLessonRepository implements LessonRepository {
  constructor(private textProcessor: TextProcessor = getTextProcessor()) {}

  async findLesson(lessonId: string, userId: string): Promise<Lesson | null> {
    const [row] = await db
      .select()
      .from(schema.lessons)
      .where(and(eq(schema.lessons.id, lessonId), eq(schema.lessons.userId, userId)))
      .limit(1);
    return row ?? null;
  }

  async findSourceText(sourceTextId: string, userId: string): Promise<SourceText | null> {
    const [row] = await db
      .select()
      .from(schema.sourceTexts)
      .where(
        and(
          eq(schema.sourceTexts.id, sourceTextId),
          eq(schema.sourceTexts.userId, userId),
          drizzleSql`${schema.sourceTexts.deletedAt} is null`
        )
      )
      .limit(1);
    return row ?? null;
  }

  async findLatestLesson(sourceTextId: string): Promise<Lesson | null> {
    const [row] = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.sourceTextId, sourceTextId))
      .orderBy(desc(schema.lessons.version))
      .limit(1);
    return row ?? null;
  }

  async createSourceTextAndLessonAndJob(
    userId: string,
    content: string,
    title: string,
    contentHash: string
  ): Promise<{ lesson: Lesson; job: GenerationJob }> {
    return await db.transaction(async (tx) => {
      const [sourceText] = await tx
        .insert(schema.sourceTexts)
        .values({
          userId,
          title,
          content,
          contentHash,
        })
        .returning();

      const [lesson] = await tx
        .insert(schema.lessons)
        .values({
          sourceTextId: sourceText.id,
          userId,
          version: 1,
          title: "Generating lesson",
          analysisStatus: "pending",
          exerciseStatus: "pending",
        })
        .returning();

      const [job] = await tx
        .insert(schema.generationJobs)
        .values({
          userId,
          sourceTextId: sourceText.id,
          lessonId: lesson.id,
          status: "queued",
          stage: "analysis",
        })
        .returning();

      return { lesson, job };
    });
  }

  async createLessonAndJob(
    userId: string,
    sourceTextId: string,
    version: number,
    stage: "analysis" | "exercises"
  ): Promise<{ lesson: Lesson; job: GenerationJob }> {
    return await db.transaction(async (tx) => {
      const [lesson] = await tx
        .insert(schema.lessons)
        .values({
          sourceTextId,
          userId,
          version,
          title: `Regeneration ${version}`,
          analysisStatus: "pending",
          exerciseStatus: "pending",
        })
        .returning();

      const [job] = await tx
        .insert(schema.generationJobs)
        .values({
          userId,
          sourceTextId,
          lessonId: lesson.id,
          status: "queued",
          stage,
        })
        .returning();

      return { lesson, job };
    });
  }

  async createJob(
    userId: string,
    sourceTextId: string,
    lessonId: string,
    stage: "analysis" | "exercises"
  ): Promise<GenerationJob> {
    return await db.transaction(async (tx) => {
      const [job] = await tx
        .insert(schema.generationJobs)
        .values({
          userId,
          sourceTextId,
          lessonId,
          status: "queued",
          stage,
        })
        .returning();

      if (stage === "analysis") {
        await tx
          .update(schema.lessons)
          .set({ analysisStatus: "pending", exerciseStatus: "pending" })
          .where(eq(schema.lessons.id, lessonId));
      } else {
        await tx
          .update(schema.lessons)
          .set({ exerciseStatus: "pending" })
          .where(eq(schema.lessons.id, lessonId));
      }

      return job;
    });
  }

  async claimJob(workerId: string): Promise<GenerationJob | null> {
    const rows = await rawSql`
      update generation_jobs
      set status = 'running',
          locked_at = now(),
          locked_by = ${workerId},
          attempts = attempts + 1,
          updated_at = now()
      where id = (
        select id
        from generation_jobs
        where status = 'queued'
        order by created_at asc
        for update skip locked
        limit 1
      )
      returning
        id,
        user_id as "userId",
        source_text_id as "sourceTextId",
        lesson_id as "lessonId",
        status,
        stage,
        attempts,
        error_message as "errorMessage",
        locked_at as "lockedAt",
        locked_by as "lockedBy",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
    const job = rows[0] as typeof schema.generationJobs.$inferSelect | undefined;
    return job ?? null;
  }

  async updateJobStatus(
    jobId: string,
    status: "queued" | "running" | "succeeded" | "failed",
    extra?: Partial<GenerationJob>
  ): Promise<void> {
    await db
      .update(schema.generationJobs)
      .set({
        status,
        ...extra,
        updatedAt: new Date(),
      })
      .where(eq(schema.generationJobs.id, jobId));
  }

  async assertQueueCapacity(userId: string): Promise<string | null> {
    const [running] = await db
      .select({ value: count() })
      .from(schema.generationJobs)
      .where(and(eq(schema.generationJobs.userId, userId), eq(schema.generationJobs.status, "running")));
    if ((running?.value ?? 0) >= 1) return "You already have a generation job running.";

    const [queued] = await db
      .select({ value: count() })
      .from(schema.generationJobs)
      .where(and(eq(schema.generationJobs.userId, userId), eq(schema.generationJobs.status, "queued")));
    if ((queued?.value ?? 0) >= 3) return "You already have three queued generation jobs.";

    return null;
  }

  async updateLessonStatus(
    lessonId: string,
    stage: "analysis" | "exercise",
    status: "pending" | "running" | "succeeded" | "failed",
    extra?: Partial<Lesson>
  ): Promise<void> {
    const field = stage === "analysis" ? "analysisStatus" : "exerciseStatus";
    await db
      .update(schema.lessons)
      .set({
        [field]: status,
        ...(extra as any),
        updatedAt: new Date(),
      })
      .where(eq(schema.lessons.id, lessonId));
  }

  async saveAnalysis(
    lessonId: string,
    userId: string,
    analysis: AnalysisResult,
    model: string
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.lessons)
        .set({
          title: analysis.title,
          textType: analysis.textType,
          detectedLevel: analysis.detectedLevel,
          summaryVi: analysis.summaryVi,
          naturalTranslationVi: analysis.naturalTranslationVi,
          contextExplanationVi: analysis.contextExplanationVi,
          analysisStatus: "succeeded",
          analysisPromptVersion: PROMPT_VERSIONS.analysis,
          analysisModel: model,
          updatedAt: new Date(),
        })
        .where(eq(schema.lessons.id, lessonId));

      if (analysis.keyPhrases.length) {
        await tx.insert(schema.keyPhrases).values(
          analysis.keyPhrases.map((phrase) => ({
            lessonId,
            userId,
            phrase: phrase.phrase,
            conceptKey: phrase.conceptKey,
            conceptPhrase: phrase.conceptPhrase,
            conceptMeaningVi: phrase.conceptMeaningVi,
            normalizedPhrase: this.textProcessor.normalizePhrase(phrase.phrase),
            senseKey: this.textProcessor.buildSenseKey(phrase.phrase, phrase.meaningVi, phrase.category),
            meaningVi: phrase.meaningVi,
            meaningInContextVi: phrase.meaningInContextVi,
            exampleEn: phrase.exampleEn,
            exampleVi: phrase.exampleVi,
            literalTranslationVi: phrase.literalTranslationVi,
            naturalTranslationVi: phrase.naturalTranslationVi,
            whyConfusingVi: phrase.whyConfusingVi,
            category: phrase.category,
            difficulty: phrase.difficulty,
            isSensitive:
              !this.textProcessor.isSafe(phrase.phrase) ||
              !this.textProcessor.isSafe(phrase.meaningVi) ||
              !this.textProcessor.isSafe(phrase.meaningInContextVi),
          }))
        );
      }

      if (analysis.sentenceBreakdowns.length) {
        await tx.insert(schema.sentenceBreakdowns).values(
          analysis.sentenceBreakdowns.map((breakdown, index) => ({
            lessonId,
            userId,
            sentence: breakdown.sentence,
            naturalMeaningVi: breakdown.naturalMeaningVi,
            structureNotesVi: breakdown.structureNotesVi,
            toneOrContextVi: breakdown.toneOrContextVi,
            orderIndex: index,
          }))
        );
      }

      if (analysis.lessonFocuses.length) {
        await tx.insert(schema.lessonFocuses).values(
          analysis.lessonFocuses.map((focus) => ({
            lessonId,
            userId,
            title: focus.title,
            conceptKey: focus.conceptKey,
            conceptPhrase: focus.conceptPhrase,
            conceptMeaningVi: focus.conceptMeaningVi,
            category: focus.category,
            explanationVi: focus.explanationVi,
            difficulty: focus.difficulty,
          }))
        );
      }
    });
  }

  async saveExercises(
    lessonId: string,
    userId: string,
    exercises: ExercisesResult,
    model: string
  ): Promise<void> {
    const phrases = await db.select().from(schema.keyPhrases).where(eq(schema.keyPhrases.lessonId, lessonId));
    const lessonFocuses = await db.select().from(schema.lessonFocuses).where(eq(schema.lessonFocuses.lessonId, lessonId));
    const phraseByNormalized = new Map(phrases.map((phrase) => [this.textProcessor.normalizePhrase(phrase.phrase), phrase]));
    const focusByNormalized = new Map(lessonFocuses.map((focus) => [this.textProcessor.normalizePhrase(focus.title), focus]));

    await db.transaction(async (tx) => {
      await tx.delete(schema.exercises).where(eq(schema.exercises.lessonId, lessonId));
      if (exercises.exercises.length) {
        await tx.insert(schema.exercises).values(
          exercises.exercises.map((exercise, index) => {
            const keyPhrase = "phrase" in exercise ? phraseByNormalized.get(this.textProcessor.normalizePhrase(exercise.phrase)) : undefined;
            const lessonFocus = "focus" in exercise ? focusByNormalized.get(this.textProcessor.normalizePhrase(exercise.focus)) : undefined;
            return {
              lessonId,
              userId,
              keyPhraseId: keyPhrase?.id,
              lessonFocusId: lessonFocus?.id,
              type: exercise.type,
              promptVi: exercise.promptVi,
              promptEn: "promptEn" in exercise ? exercise.promptEn : undefined,
              choices: "choices" in exercise ? exercise.choices : undefined,
              correctAnswer: "correctAnswer" in exercise ? exercise.correctAnswer : undefined,
              acceptableAnswers: "acceptableAnswers" in exercise ? exercise.acceptableAnswers : undefined,
              rubricVi: "rubricVi" in exercise ? exercise.rubricVi : undefined,
              orderIndex: index,
            };
          })
        );
      }

      await tx
        .update(schema.lessons)
        .set({
          exerciseStatus: "succeeded",
          exercisePromptVersion: PROMPT_VERSIONS.exercises,
          exerciseModel: model,
          updatedAt: new Date(),
        })
        .where(eq(schema.lessons.id, lessonId));
    });
  }

  async buildAnalysisFromLesson(lessonId: string): Promise<AnalysisResult> {
    const [lesson] = await db.select().from(schema.lessons).where(eq(schema.lessons.id, lessonId)).limit(1);
    if (!lesson?.summaryVi || !lesson.naturalTranslationVi || !lesson.contextExplanationVi || !lesson.detectedLevel) {
      throw new Error("Lesson analysis is incomplete.");
    }
    const phrases = await db
      .select()
      .from(schema.keyPhrases)
      .where(eq(schema.keyPhrases.lessonId, lessonId))
      .orderBy(asc(schema.keyPhrases.createdAt));
    const lessonFocuses = await db
      .select()
      .from(schema.lessonFocuses)
      .where(eq(schema.lessonFocuses.lessonId, lessonId))
      .orderBy(asc(schema.lessonFocuses.createdAt));
    const sentenceBreakdowns = await db
      .select()
      .from(schema.sentenceBreakdowns)
      .where(eq(schema.sentenceBreakdowns.lessonId, lessonId))
      .orderBy(schema.sentenceBreakdowns.orderIndex);

    return {
      title: lesson.title,
      textType: lesson.textType,
      detectedLevel: lesson.detectedLevel,
      summaryVi: lesson.summaryVi,
      naturalTranslationVi: lesson.naturalTranslationVi,
      contextExplanationVi: lesson.contextExplanationVi,
      sentenceBreakdowns: sentenceBreakdowns.map((breakdown) => ({
        sentence: breakdown.sentence,
        naturalMeaningVi: breakdown.naturalMeaningVi,
        structureNotesVi: breakdown.structureNotesVi,
        toneOrContextVi: breakdown.toneOrContextVi ?? undefined,
      })),
      keyPhrases: phrases.map((phrase) => ({
        phrase: phrase.phrase,
        conceptKey: phrase.conceptKey,
        conceptPhrase: phrase.conceptPhrase,
        conceptMeaningVi: phrase.conceptMeaningVi,
        meaningVi: phrase.meaningVi,
        meaningInContextVi: phrase.meaningInContextVi,
        exampleEn: phrase.exampleEn ?? phrase.phrase,
        exampleVi: phrase.exampleVi ?? phrase.meaningInContextVi,
        literalTranslationVi: phrase.literalTranslationVi ?? undefined,
        naturalTranslationVi: phrase.naturalTranslationVi ?? undefined,
        whyConfusingVi: phrase.whyConfusingVi ?? undefined,
        category: phrase.category,
        difficulty: phrase.difficulty,
      })),
      lessonFocuses: lessonFocuses.map((focus) => ({
        title: focus.title,
        conceptKey: focus.conceptKey,
        conceptPhrase: focus.conceptPhrase,
        conceptMeaningVi: focus.conceptMeaningVi,
        category: focus.category,
        explanationVi: focus.explanationVi,
        difficulty: focus.difficulty,
      })),
    };
  }

  async deleteSourceText(userId: string, sourceTextId: string): Promise<void> {
    const lessons = await db
      .select({ id: schema.lessons.id })
      .from(schema.lessons)
      .where(and(eq(schema.lessons.sourceTextId, sourceTextId), eq(schema.lessons.userId, userId)));

    const lessonIds = lessons.map((lesson) => lesson.id);
    if (lessonIds.length) {
      const patterns = await db
        .select()
        .from(schema.mistakePatterns)
        .where(eq(schema.mistakePatterns.userId, userId));

      const sensitivePatternIds = patterns
        .filter((pattern) =>
          this.textProcessor.shouldScrubMistakePattern({
            normalizedPhrase: pattern.normalizedPhrase,
            meaningVi: pattern.meaningVi,
            safeReviewPromptVi: pattern.safeReviewPromptVi,
          })
        )
        .map((pattern) => pattern.id);

      if (sensitivePatternIds.length) {
        await db.delete(schema.mistakePatterns).where(inArray(schema.mistakePatterns.id, sensitivePatternIds));
      }
    }

    await db
      .delete(schema.sourceTexts)
      .where(and(eq(schema.sourceTexts.id, sourceTextId), eq(schema.sourceTexts.userId, userId)));
  }

  async recordMilestone(input: {
    lessonId: string;
    generationJobId: string;
    code: GenerationMilestoneCode;
    stage: GenerationStage;
  }): Promise<void> {
    await rawSql`
      insert into generation_milestones (lesson_id, generation_job_id, code, stage)
      select
        ${input.lessonId},
        ${input.generationJobId},
        ${input.code}::generation_milestone_code,
        ${input.stage}
      where not exists (
        select 1
        from generation_milestones
        where generation_job_id = ${input.generationJobId}
          and code = ${input.code}::generation_milestone_code
          and stage is not distinct from ${input.stage}
      )
    `;
  }

  async recordThought(input: {
    lessonId: string;
    generationJobId: string;
    stage: GenerationStage;
    text: string;
  }): Promise<void> {
    const text = sanitizeGenerationThought(input.text);
    if (!text) return;

    const [latest] = await db
      .select({ text: schema.generationThoughts.text })
      .from(schema.generationThoughts)
      .where(eq(schema.generationThoughts.generationJobId, input.generationJobId))
      .orderBy(desc(schema.generationThoughts.id))
      .limit(1);
    if (latest?.text === text) return;

    await db
      .insert(schema.generationThoughts)
      .values({
        lessonId: input.lessonId,
        generationJobId: input.generationJobId,
        stage: input.stage,
        text,
      });
  }

  async getLessonProgress(input: {
    lessonId: string;
    userId: string;
    afterMilestoneId?: number;
    afterThoughtId?: number;
  }): Promise<{
    lesson: {
      id: string;
      analysisStatus: "pending" | "running" | "succeeded" | "failed";
      exerciseStatus: "pending" | "running" | "succeeded" | "failed";
    };
    job: GenerationJob | null;
    milestones: GenerationMilestone[];
    thoughts: GenerationThought[];
  } | null> {
    const [lesson] = await db
      .select({
        id: schema.lessons.id,
        analysisStatus: schema.lessons.analysisStatus,
        exerciseStatus: schema.lessons.exerciseStatus,
      })
      .from(schema.lessons)
      .where(and(eq(schema.lessons.id, input.lessonId), eq(schema.lessons.userId, input.userId)))
      .limit(1);
    if (!lesson) return null;

    const jobs = await db
      .select()
      .from(schema.generationJobs)
      .where(and(eq(schema.generationJobs.lessonId, input.lessonId), eq(schema.generationJobs.userId, input.userId)))
      .orderBy(desc(schema.generationJobs.createdAt));
    const job = selectDisplayGenerationJob(jobs);

    const milestoneFilters: SQL[] = [];
    const thoughtFilters: SQL[] = [];
    if (job) {
      milestoneFilters.push(eq(schema.generationMilestones.lessonId, input.lessonId));
      milestoneFilters.push(eq(schema.generationMilestones.generationJobId, job.id));
      if (input.afterMilestoneId) {
        milestoneFilters.push(gt(schema.generationMilestones.id, input.afterMilestoneId));
      }

      thoughtFilters.push(eq(schema.generationThoughts.lessonId, input.lessonId));
      thoughtFilters.push(eq(schema.generationThoughts.generationJobId, job.id));
      if (input.afterThoughtId) {
        thoughtFilters.push(gt(schema.generationThoughts.id, input.afterThoughtId));
      }
    }

    const milestones = job
      ? await db
          .select()
          .from(schema.generationMilestones)
          .where(and(...milestoneFilters))
          .orderBy(schema.generationMilestones.id)
      : [];

    const thoughts = job
      ? await db
          .select()
          .from(schema.generationThoughts)
          .where(and(...thoughtFilters))
          .orderBy(schema.generationThoughts.id)
      : [];

    return {
      lesson: {
        id: lesson.id,
        analysisStatus: lesson.analysisStatus as "pending" | "running" | "succeeded" | "failed",
        exerciseStatus: lesson.exerciseStatus as "pending" | "running" | "succeeded" | "failed",
      },
      job: job ?? null,
      milestones,
      thoughts,
    };
  }

  async getLessonAggregate(
    lessonId: string,
    userId: string
  ): Promise<LessonAggregate | null> {
    const [lesson] = await db
      .select()
      .from(schema.lessons)
      .where(and(eq(schema.lessons.id, lessonId), eq(schema.lessons.userId, userId)))
      .limit(1);
    if (!lesson) return null;

    const [
      sourceTextsList,
      keyPhrases,
      sentenceBreakdowns,
      lessonFocuses,
      exercises,
      attempts,
      userErrors,
      progress,
    ] = await Promise.all([
      db
        .select()
        .from(schema.sourceTexts)
        .where(and(eq(schema.sourceTexts.id, lesson.sourceTextId), eq(schema.sourceTexts.userId, userId)))
        .limit(1),
      db
        .select()
        .from(schema.keyPhrases)
        .where(eq(schema.keyPhrases.lessonId, lesson.id))
        .orderBy(asc(schema.keyPhrases.createdAt)),
      db
        .select()
        .from(schema.sentenceBreakdowns)
        .where(eq(schema.sentenceBreakdowns.lessonId, lesson.id))
        .orderBy(schema.sentenceBreakdowns.orderIndex),
      db
        .select()
        .from(schema.lessonFocuses)
        .where(eq(schema.lessonFocuses.lessonId, lesson.id))
        .orderBy(asc(schema.lessonFocuses.createdAt)),
      db
        .select()
        .from(schema.exercises)
        .where(eq(schema.exercises.lessonId, lesson.id))
        .orderBy(schema.exercises.orderIndex),
      db
        .select()
        .from(schema.attempts)
        .where(eq(schema.attempts.lessonId, lesson.id))
        .orderBy(desc(schema.attempts.createdAt)),
      db
        .select()
        .from(schema.userErrors)
        .where(eq(schema.userErrors.lessonId, lesson.id)),
      this.getLessonProgress({ lessonId: lesson.id, userId }),
    ]);

    return {
      lesson,
      sourceText: sourceTextsList[0] ?? null,
      keyPhrases,
      sentenceBreakdowns,
      lessonFocuses,
      exercises,
      attempts,
      userErrors,
      progress,
    };
  }

  async getRecentLessons(
    userId: string,
    limit: number
  ): Promise<Array<{
    id: string;
    title: string | null;
    version: number;
    analysisStatus: "pending" | "running" | "succeeded" | "failed";
    exerciseStatus: "pending" | "running" | "succeeded" | "failed";
    createdAt: Date;
  }>> {
    const rows = await db
      .select({
        id: schema.lessons.id,
        title: schema.lessons.title,
        version: schema.lessons.version,
        analysisStatus: schema.lessons.analysisStatus,
        exerciseStatus: schema.lessons.exerciseStatus,
        createdAt: schema.lessons.createdAt,
      })
      .from(schema.lessons)
      .where(eq(schema.lessons.userId, userId))
      .orderBy(desc(schema.lessons.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      analysisStatus: row.analysisStatus as "pending" | "running" | "succeeded" | "failed",
      exerciseStatus: row.exerciseStatus as "pending" | "running" | "succeeded" | "failed",
    }));
  }

  async getSourceTextsCount(userId: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(schema.sourceTexts)
      .where(eq(schema.sourceTexts.userId, userId));
    return row?.value ?? 0;
  }
}
