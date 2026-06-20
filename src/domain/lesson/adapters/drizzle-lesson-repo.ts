import {
  and,
  asc,
  desc,
  eq,
  count,
  or,
  gt,
  sql as drizzleSql,
  type SQL,
} from "drizzle-orm";
import { db, schema, sql as rawSql, type DbClient, type DrizzleTx } from "@/db";
import { PROMPT_VERSIONS } from "@/domain/constants";
import { getTextProcessor, type TextProcessor } from "@/domain/text";
import { findMatchingLessonFocus } from "../rules";
import {
  selectDisplayGenerationJob,
  type GenerationMilestoneCode,
  type GenerationStage,
  sanitizeGenerationThought,
} from "@/domain/generation-progress";
import type { GenerationStatus, JobStatus, DiffType } from "@/domain/types";
import type {
  LessonRepository,
  Lesson,
  KeyPhrase,
  LessonFocus,
  SentenceBreakdown,
  Exercise,
  SaveAnalysisInput,
  SaveExercisesInput,
  LessonAggregate,
  GenerationJob,
  SourceText,
  GenerationMilestone,
  GenerationThought,
  TextType,
  DetectedLevel,
  DraftText,
  CorrectionItem,
} from "../ports";
import type {
  KeyPhrase as DbKeyPhrase,
  LessonFocus as DbLessonFocus,
  SentenceBreakdown as DbSentenceBreakdown,
} from "@/db/schema";

export class DrizzleLessonRepository implements LessonRepository {
  constructor(
    private dbClient: DbClient = db,
    private textProcessor: TextProcessor = getTextProcessor()
  ) {}

  // ==========================================
  // SourceText Methods
  // ==========================================

  async findSourceText(
    sourceTextId: string,
    userId: string
  ): Promise<SourceText | null> {
    const [row] = await this.dbClient
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

  async deleteSourceText(userId: string, sourceTextId: string): Promise<void> {
    await this.dbClient
      .delete(schema.sourceTexts)
      .where(
        and(
          eq(schema.sourceTexts.id, sourceTextId),
          eq(schema.sourceTexts.userId, userId)
        )
      );
  }

  async getSourceTextsCount(userId: string): Promise<number> {
    const [row] = await this.dbClient
      .select({ value: count() })
      .from(schema.sourceTexts)
      .where(eq(schema.sourceTexts.userId, userId));
    return row?.value ?? 0;
  }

  // ==========================================
  // Lesson Methods
  // ==========================================

  async findLesson(lessonId: string, userId: string): Promise<Lesson | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.lessons)
      .where(
        and(eq(schema.lessons.id, lessonId), eq(schema.lessons.userId, userId))
      )
      .limit(1);
    return (row as Lesson) ?? null;
  }

  async findLatestLesson(sourceTextId: string): Promise<Lesson | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.sourceTextId, sourceTextId))
      .orderBy(desc(schema.lessons.version))
      .limit(1);
    return (row as Lesson) ?? null;
  }

  async findKeyPhrase(keyPhraseId: string): Promise<KeyPhrase | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.keyPhrases)
      .where(eq(schema.keyPhrases.id, keyPhraseId))
      .limit(1);
    return (row as KeyPhrase) ?? null;
  }

  async findKeyPhrases(lessonId: string): Promise<KeyPhrase[]> {
    const rows = await this.dbClient
      .select()
      .from(schema.keyPhrases)
      .where(eq(schema.keyPhrases.lessonId, lessonId));
    return rows as KeyPhrase[];
  }

  async findLessonFocus(lessonFocusId: string): Promise<LessonFocus | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.lessonFocuses)
      .where(eq(schema.lessonFocuses.id, lessonFocusId))
      .limit(1);
    return (row as LessonFocus) ?? null;
  }

  async updateLessonStatus(
    lessonId: string,
    stage: "analysis" | "exercise",
    status: GenerationStatus,
    extra?: Partial<Lesson>
  ): Promise<void> {
    const field = stage === "analysis" ? "analysisStatus" : "exerciseStatus";
    await this.dbClient
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
    analysis: SaveAnalysisInput,
    model: string
  ): Promise<void> {
    const [lessonRow] = await this.dbClient
      .select({ sourceTextId: schema.lessons.sourceTextId })
      .from(schema.lessons)
      .where(
        and(eq(schema.lessons.id, lessonId), eq(schema.lessons.userId, userId))
      )
      .limit(1);

    if (!lessonRow) {
      throw new Error(`Lesson ${lessonId} not found.`);
    }

    const [sourceTextRow] = await this.dbClient
      .select({ content: schema.sourceTexts.content })
      .from(schema.sourceTexts)
      .where(
        and(
          eq(schema.sourceTexts.id, lessonRow.sourceTextId),
          eq(schema.sourceTexts.userId, userId)
        )
      )
      .limit(1);

    if (!sourceTextRow) {
      throw new Error(`Source text ${lessonRow.sourceTextId} not found.`);
    }

    await this.dbClient.transaction(async (tx: DrizzleTx) => {
      await tx
        .update(schema.lessons)
        .set({
          title: analysis.title,
          textType: analysis.textType,
          inputMode: analysis.inputMode,
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
            senseKey: this.textProcessor.buildSenseKey(
              phrase.phrase,
              phrase.meaningVi,
              phrase.category
            ),
            meaningVi: phrase.meaningVi,
            meaningInContextVi: phrase.meaningInContextVi,
            examples: phrase.examples,
            literalTranslationVi: phrase.literalTranslationVi || null,
            naturalTranslationVi: phrase.naturalTranslationVi || null,
            whyConfusingVi: phrase.whyConfusingVi || null,
            ipa: phrase.ipa || null,
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
            correctedSentenceEn: breakdown.correctedSentenceEn ?? null,
            diffSpans: breakdown.diffSpans ?? null,
            naturalMeaningVi: breakdown.naturalMeaningVi,
            structureNotesVi: breakdown.structureNotesVi,
            toneOrContextVi: breakdown.toneOrContextVi ?? null,
            ipa: breakdown.ipa || null,
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

      if (analysis.correctionItems && analysis.correctionItems.length) {
        await tx.insert(schema.correctionItems).values(
          analysis.correctionItems.map((item, index) => ({
            lessonId,
            draftPhrase: item.draftPhrase,
            correctedPhrase: item.correctedPhrase,
            explanationVi: item.explanationVi,
            literalTrapVi: item.literalTrapVi || null,
            exampleEn: item.exampleEn,
            exampleVi: item.exampleVi,
            category: item.category,
            errorType: item.errorType,
            orderIndex: index,
          }))
        );
      }
    });
  }

  async saveExercises(
    lessonId: string,
    userId: string,
    exercises: SaveExercisesInput,
    model: string
  ): Promise<void> {
    const [phrases, lessonFocuses, correctionItems] = await Promise.all([
      this.dbClient
        .select()
        .from(schema.keyPhrases)
        .where(eq(schema.keyPhrases.lessonId, lessonId)),
      this.dbClient
        .select()
        .from(schema.lessonFocuses)
        .where(eq(schema.lessonFocuses.lessonId, lessonId)),
      this.dbClient
        .select()
        .from(schema.correctionItems)
        .where(eq(schema.correctionItems.lessonId, lessonId)),
    ]);

    const phraseByNormalized = new Map<string, DbKeyPhrase>(
      phrases.map((phrase: DbKeyPhrase) => [
        this.textProcessor.normalizePhrase(phrase.phrase),
        phrase,
      ])
    );

    await this.dbClient.transaction(async (tx: DrizzleTx) => {
      await tx
        .delete(schema.exercises)
        .where(eq(schema.exercises.lessonId, lessonId));
      if (exercises.exercises.length) {
        await tx.insert(schema.exercises).values(
          exercises.exercises.map((exercise, index) => {
            const keyPhrase = exercise.phrase
              ? phraseByNormalized.get(
                  this.textProcessor.normalizePhrase(exercise.phrase)
                )
              : undefined;
            const lessonFocus = exercise.focus
              ? findMatchingLessonFocus(
                  exercise.focus,
                  lessonFocuses,
                  this.textProcessor
                )
              : undefined;
            const phraseStr = exercise.phrase;
            const matchedCorrection = phraseStr
              ? correctionItems.find(
                  (c) =>
                    this.textProcessor.normalizePhrase(c.correctedPhrase) ===
                      this.textProcessor.normalizePhrase(phraseStr) ||
                    this.textProcessor.normalizePhrase(c.draftPhrase) ===
                      this.textProcessor.normalizePhrase(phraseStr)
                )
              : undefined;

            return {
              lessonId,
              userId,
              keyPhraseId: keyPhrase?.id ?? null,
              lessonFocusId: lessonFocus?.id ?? null,
              correctionItemId: matchedCorrection?.id ?? null,
              type: exercise.type,
              promptVi: exercise.promptVi,
              promptEn: exercise.promptEn ?? null,
              choices: exercise.choices ?? null,
              correctAnswer: exercise.correctAnswer ?? null,
              acceptableAnswers: exercise.acceptableAnswers ?? null,
              rubricVi: exercise.rubricVi ?? null,
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

  async buildAnalysisFromLesson(lessonId: string): Promise<SaveAnalysisInput> {
    const [lesson] = await this.dbClient
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.id, lessonId))
      .limit(1);
    if (!lesson) {
      throw new Error("Lesson not found.");
    }
    const isDiff = lesson.inputMode === "diff";
    if (
      !lesson.summaryVi ||
      (!isDiff &&
        (!lesson.naturalTranslationVi || !lesson.contextExplanationVi)) ||
      !lesson.detectedLevel
    ) {
      throw new Error("Lesson analysis is incomplete.");
    }
    const [phrases, lessonFocuses, sentenceBreakdowns, correctionItems] =
      await Promise.all([
        this.dbClient
          .select()
          .from(schema.keyPhrases)
          .where(eq(schema.keyPhrases.lessonId, lessonId))
          .orderBy(asc(schema.keyPhrases.createdAt)),
        this.dbClient
          .select()
          .from(schema.lessonFocuses)
          .where(eq(schema.lessonFocuses.lessonId, lessonId))
          .orderBy(asc(schema.lessonFocuses.createdAt)),
        this.dbClient
          .select()
          .from(schema.sentenceBreakdowns)
          .where(eq(schema.sentenceBreakdowns.lessonId, lessonId))
          .orderBy(schema.sentenceBreakdowns.orderIndex),
        this.dbClient
          .select()
          .from(schema.correctionItems)
          .where(eq(schema.correctionItems.lessonId, lessonId))
          .orderBy(asc(schema.correctionItems.orderIndex)),
      ]);

    return {
      title: lesson.title,
      textType: lesson.textType as TextType,
      inputMode: lesson.inputMode,
      detectedLevel: lesson.detectedLevel as DetectedLevel,
      summaryVi: lesson.summaryVi,
      naturalTranslationVi: lesson.naturalTranslationVi ?? "",
      contextExplanationVi: lesson.contextExplanationVi ?? "",
      sentenceBreakdowns: sentenceBreakdowns.map(
        (breakdown: DbSentenceBreakdown) => ({
          sentence: breakdown.sentence,
          correctedSentenceEn: breakdown.correctedSentenceEn ?? undefined,
          diffSpans:
            (breakdown.diffSpans as Array<{
              type: DiffType;
              text: string;
            }> | null) ?? undefined,
          naturalMeaningVi: breakdown.naturalMeaningVi,
          structureNotesVi: breakdown.structureNotesVi,
          toneOrContextVi: breakdown.toneOrContextVi ?? undefined,
          ipa: breakdown.ipa ?? undefined,
        })
      ),
      keyPhrases: phrases.map((phrase: DbKeyPhrase) => ({
        phrase: phrase.phrase,
        conceptKey: phrase.conceptKey,
        conceptPhrase: phrase.conceptPhrase,
        conceptMeaningVi: phrase.conceptMeaningVi,
        meaningVi: phrase.meaningVi,
        meaningInContextVi: phrase.meaningInContextVi ?? "",
        examples: phrase.examples ?? [],
        literalTranslationVi: phrase.literalTranslationVi ?? undefined,
        naturalTranslationVi: phrase.naturalTranslationVi ?? undefined,
        whyConfusingVi: phrase.whyConfusingVi ?? undefined,
        ipa: phrase.ipa ?? undefined,
        category: phrase.category,
        difficulty: phrase.difficulty as DetectedLevel,
      })),
      lessonFocuses: lessonFocuses.map((focus: DbLessonFocus) => ({
        title: focus.title,
        conceptKey: focus.conceptKey,
        conceptPhrase: focus.conceptPhrase,
        conceptMeaningVi: focus.conceptMeaningVi,
        category: focus.category,
        explanationVi: focus.explanationVi,
        difficulty: focus.difficulty as DetectedLevel,
      })),
      correctionItems: correctionItems.map((item) => ({
        draftPhrase: item.draftPhrase,
        correctedPhrase: item.correctedPhrase,
        explanationVi: item.explanationVi,
        literalTrapVi: item.literalTrapVi ?? undefined,
        exampleEn: item.exampleEn,
        exampleVi: item.exampleVi,
        category: item.category,
        errorType: item.errorType,
      })),
    };
  }

  private async getLessonProgressHelper(
    lessonId: string,
    userId: string
  ): Promise<any> {
    const [lesson] = await this.dbClient
      .select({
        id: schema.lessons.id,
        analysisStatus: schema.lessons.analysisStatus,
        exerciseStatus: schema.lessons.exerciseStatus,
      })
      .from(schema.lessons)
      .where(
        and(eq(schema.lessons.id, lessonId), eq(schema.lessons.userId, userId))
      )
      .limit(1);
    if (!lesson) return null;

    const jobs = (await this.dbClient
      .select()
      .from(schema.generationJobs)
      .where(
        and(
          eq(schema.generationJobs.lessonId, lessonId),
          eq(schema.generationJobs.userId, userId)
        )
      )
      .orderBy(desc(schema.generationJobs.createdAt))) as GenerationJob[];
    const job = selectDisplayGenerationJob(jobs);

    const milestones = job
      ? await this.dbClient
          .select()
          .from(schema.generationMilestones)
          .where(
            and(
              eq(schema.generationMilestones.lessonId, lessonId),
              eq(schema.generationMilestones.generationJobId, job.id)
            )
          )
          .orderBy(schema.generationMilestones.id)
      : [];

    const thoughts = job
      ? await this.dbClient
          .select()
          .from(schema.generationThoughts)
          .where(
            and(
              eq(schema.generationThoughts.lessonId, lessonId),
              eq(schema.generationThoughts.generationJobId, job.id)
            )
          )
          .orderBy(schema.generationThoughts.id)
      : [];

    return {
      lesson: {
        id: lesson.id,
        analysisStatus: lesson.analysisStatus,
        exerciseStatus: lesson.exerciseStatus,
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
    const [lesson] = await this.dbClient
      .select()
      .from(schema.lessons)
      .where(
        and(eq(schema.lessons.id, lessonId), eq(schema.lessons.userId, userId))
      )
      .limit(1);
    if (!lesson) return null;

    const [
      sourceTextsList,
      keyPhrases,
      sentenceBreakdowns,
      lessonFocuses,
      exercises,
      draftTextsList,
      correctionItems,
      progress,
    ] = await Promise.all([
      this.dbClient
        .select()
        .from(schema.sourceTexts)
        .where(
          and(
            eq(schema.sourceTexts.id, lesson.sourceTextId),
            eq(schema.sourceTexts.userId, userId)
          )
        )
        .limit(1),
      this.dbClient
        .select()
        .from(schema.keyPhrases)
        .where(eq(schema.keyPhrases.lessonId, lesson.id))
        .orderBy(asc(schema.keyPhrases.createdAt)),
      this.dbClient
        .select()
        .from(schema.sentenceBreakdowns)
        .where(eq(schema.sentenceBreakdowns.lessonId, lesson.id))
        .orderBy(schema.sentenceBreakdowns.orderIndex),
      this.dbClient
        .select()
        .from(schema.lessonFocuses)
        .where(eq(schema.lessonFocuses.lessonId, lesson.id))
        .orderBy(asc(schema.lessonFocuses.createdAt)),
      this.dbClient
        .select()
        .from(schema.exercises)
        .where(eq(schema.exercises.lessonId, lesson.id))
        .orderBy(schema.exercises.orderIndex),
      this.dbClient
        .select()
        .from(schema.draftTexts)
        .where(
          and(
            eq(schema.draftTexts.sourceTextId, lesson.sourceTextId),
            eq(schema.draftTexts.userId, userId)
          )
        )
        .limit(1),
      this.dbClient
        .select()
        .from(schema.correctionItems)
        .where(eq(schema.correctionItems.lessonId, lesson.id))
        .orderBy(asc(schema.correctionItems.orderIndex)),
      this.getLessonProgressHelper(lesson.id, userId),
    ]);

    return {
      lesson: lesson as Lesson,
      sourceText: sourceTextsList[0] ?? null,
      keyPhrases: keyPhrases as KeyPhrase[],
      sentenceBreakdowns: sentenceBreakdowns as SentenceBreakdown[],
      lessonFocuses: lessonFocuses as LessonFocus[],
      exercises: exercises as Exercise[],
      draftText: (draftTextsList[0] ?? null) as DraftText | null,
      correctionItems: correctionItems as CorrectionItem[],
      progress,
    };
  }

  async getRecentLessons(
    userId: string,
    limit: number
  ): Promise<
    Array<{
      id: string;
      title: string;
      version: number;
      analysisStatus: GenerationStatus;
      exerciseStatus: GenerationStatus;
      textType: TextType;
      inputMode: string;
      detectedLevel: DetectedLevel | null;
      createdAt: Date;
    }>
  > {
    const rows = await this.dbClient
      .select({
        id: schema.lessons.id,
        title: schema.lessons.title,
        version: schema.lessons.version,
        analysisStatus: schema.lessons.analysisStatus,
        exerciseStatus: schema.lessons.exerciseStatus,
        textType: schema.lessons.textType,
        inputMode: schema.lessons.inputMode,
        detectedLevel: schema.lessons.detectedLevel,
        createdAt: schema.lessons.createdAt,
      })
      .from(schema.lessons)
      .where(eq(schema.lessons.userId, userId))
      .orderBy(desc(schema.lessons.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      textType: (row.textType ?? "unknown") as TextType,
      detectedLevel: row.detectedLevel as DetectedLevel | null,
    }));
  }

  // ==========================================
  // GenerationJob Methods
  // ==========================================

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
           or (status = 'running' and locked_at < now() - interval '10 minutes')
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
    const job = rows[0] as
      | typeof schema.generationJobs.$inferSelect
      | undefined;
    return (job as GenerationJob) ?? null;
  }

  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    extra?: Partial<GenerationJob>
  ): Promise<void> {
    await this.dbClient
      .update(schema.generationJobs)
      .set({
        status,
        ...extra,
        updatedAt: new Date(),
      })
      .where(eq(schema.generationJobs.id, jobId));
  }

  async assertQueueCapacity(userId: string): Promise<string | null> {
    const [active] = await this.dbClient
      .select({ value: count() })
      .from(schema.generationJobs)
      .where(
        and(
          eq(schema.generationJobs.userId, userId),
          or(
            eq(schema.generationJobs.status, "running"),
            eq(schema.generationJobs.status, "queued")
          )
        )
      );
    if ((active?.value ?? 0) >= 1) {
      return "Bạn đang có bài học đang xử lý hoặc đang chờ trong hàng đợi. Vui lòng đợi bài học trước hoàn thành.";
    }

    return null;
  }

  async resetStuckJob(userId: string, lessonId: string): Promise<void> {
    await this.dbClient.transaction(async (tx: DrizzleTx) => {
      await tx
        .update(schema.lessons)
        .set({
          analysisStatus: "pending",
          exerciseStatus: "pending",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.lessons.id, lessonId),
            eq(schema.lessons.userId, userId)
          )
        );

      await tx
        .update(schema.generationJobs)
        .set({
          status: "queued",
          attempts: 0,
          lockedAt: null,
          lockedBy: null,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.generationJobs.lessonId, lessonId),
            eq(schema.generationJobs.userId, userId)
          )
        );
    });
  }

  // ==========================================
  // GenerationProgress Methods
  // ==========================================

  async recordMilestone(input: {
    lessonId: string;
    generationJobId: string;
    code: GenerationMilestoneCode;
    stage: GenerationStage;
  }): Promise<void> {
    await this.dbClient.execute(drizzleSql`
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
    `);
  }

  async recordThought(input: {
    lessonId: string;
    generationJobId: string;
    stage: GenerationStage;
    text: string;
  }): Promise<void> {
    const text = sanitizeGenerationThought(input.text, this.textProcessor);
    if (!text) return;

    const [latest] = await this.dbClient
      .select({ text: schema.generationThoughts.text })
      .from(schema.generationThoughts)
      .where(
        eq(schema.generationThoughts.generationJobId, input.generationJobId)
      )
      .orderBy(desc(schema.generationThoughts.id))
      .limit(1);
    if (latest?.text === text) return;

    await this.dbClient.insert(schema.generationThoughts).values({
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
      analysisStatus: GenerationStatus;
      exerciseStatus: GenerationStatus;
    };
    job: GenerationJob | null;
    milestones: GenerationMilestone[];
    thoughts: GenerationThought[];
  } | null> {
    const [lesson] = await this.dbClient
      .select({
        id: schema.lessons.id,
        analysisStatus: schema.lessons.analysisStatus,
        exerciseStatus: schema.lessons.exerciseStatus,
      })
      .from(schema.lessons)
      .where(
        and(
          eq(schema.lessons.id, input.lessonId),
          eq(schema.lessons.userId, input.userId)
        )
      )
      .limit(1);
    if (!lesson) return null;

    const jobs = (await this.dbClient
      .select()
      .from(schema.generationJobs)
      .where(
        and(
          eq(schema.generationJobs.lessonId, input.lessonId),
          eq(schema.generationJobs.userId, input.userId)
        )
      )
      .orderBy(desc(schema.generationJobs.createdAt))) as GenerationJob[];
    const job = selectDisplayGenerationJob(jobs);

    const milestoneFilters: SQL[] = [];
    const thoughtFilters: SQL[] = [];
    if (job) {
      milestoneFilters.push(
        eq(schema.generationMilestones.lessonId, input.lessonId)
      );
      milestoneFilters.push(
        eq(schema.generationMilestones.generationJobId, job.id)
      );
      if (input.afterMilestoneId) {
        milestoneFilters.push(
          gt(schema.generationMilestones.id, input.afterMilestoneId)
        );
      }

      thoughtFilters.push(
        eq(schema.generationThoughts.lessonId, input.lessonId)
      );
      thoughtFilters.push(
        eq(schema.generationThoughts.generationJobId, job.id)
      );
      if (input.afterThoughtId) {
        thoughtFilters.push(
          gt(schema.generationThoughts.id, input.afterThoughtId)
        );
      }
    }

    const milestones = job
      ? await this.dbClient
          .select()
          .from(schema.generationMilestones)
          .where(and(...milestoneFilters))
          .orderBy(schema.generationMilestones.id)
      : [];

    const thoughts = job
      ? await this.dbClient
          .select()
          .from(schema.generationThoughts)
          .where(and(...thoughtFilters))
          .orderBy(schema.generationThoughts.id)
      : [];

    return {
      lesson: {
        id: lesson.id,
        analysisStatus: lesson.analysisStatus as GenerationStatus,
        exerciseStatus: lesson.exerciseStatus as GenerationStatus,
      },
      job: job ?? null,
      milestones: milestones as GenerationMilestone[],
      thoughts: thoughts as GenerationThought[],
    };
  }

  // ==========================================
  // Transaction Coordination Methods
  // ==========================================

  async createSourceTextAndLessonAndJob(
    userId: string,
    content: string,
    title: string,
    contentHash: string,
    requestedMode?: string,
    draftContent?: string
  ): Promise<{ lesson: Lesson; job: GenerationJob }> {
    return (await this.dbClient.transaction(async (tx: DrizzleTx) => {
      const [sourceText] = await tx
        .insert(schema.sourceTexts)
        .values({
          userId,
          title,
          content,
          contentHash,
        })
        .returning();

      if (draftContent) {
        await tx.insert(schema.draftTexts).values({
          userId,
          sourceTextId: sourceText.id,
          content: draftContent,
        });
      }

      const [lesson] = await tx
        .insert(schema.lessons)
        .values({
          sourceTextId: sourceText.id,
          userId,
          version: 1,
          title: "Generating lesson",
          inputMode: requestedMode || "understand_and_practice",
          analysisStatus: "pending",
          exerciseStatus: "idle",
          createdAt: new Date(),
          updatedAt: new Date(),
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
    })) as { lesson: Lesson; job: GenerationJob };
  }

  async createLessonAndJob(
    userId: string,
    sourceTextId: string,
    version: number,
    stage: "analysis" | "exercises"
  ): Promise<{ lesson: Lesson; job: GenerationJob }> {
    return (await this.dbClient.transaction(async (tx: DrizzleTx) => {
      const [lesson] = await tx
        .insert(schema.lessons)
        .values({
          sourceTextId,
          userId,
          version,
          title: `Regeneration ${version}`,
          analysisStatus: "pending",
          exerciseStatus: "idle",
          createdAt: new Date(),
          updatedAt: new Date(),
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
    })) as { lesson: Lesson; job: GenerationJob };
  }

  async createJob(
    userId: string,
    sourceTextId: string,
    lessonId: string,
    stage: "analysis" | "exercises"
  ): Promise<GenerationJob> {
    return (await this.dbClient.transaction(async (tx: DrizzleTx) => {
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
          .set({
            analysisStatus: "pending",
            exerciseStatus: "pending",
            updatedAt: new Date(),
          })
          .where(eq(schema.lessons.id, lessonId));
      } else {
        await tx
          .update(schema.lessons)
          .set({ exerciseStatus: "pending", updatedAt: new Date() })
          .where(eq(schema.lessons.id, lessonId));
      }

      return job;
    })) as GenerationJob;
  }
}
