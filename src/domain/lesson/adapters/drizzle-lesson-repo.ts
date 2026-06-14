import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { PROMPT_VERSIONS } from "@/domain/constants";
import { getTextProcessor, type TextProcessor } from "@/domain/text";
import { findMatchingLessonFocus } from "../rules";
import { selectDisplayGenerationJob } from "@/domain/generation-progress";
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
} from "../ports";
import type {
  KeyPhrase as DbKeyPhrase,
  LessonFocus as DbLessonFocus,
  SentenceBreakdown as DbSentenceBreakdown,
} from "@/db/schema";

export class DrizzleLessonRepository implements LessonRepository {
  constructor(
    private dbClient: any = db,
    private textProcessor: TextProcessor = getTextProcessor()
  ) {}

  async findLesson(lessonId: string, userId: string): Promise<Lesson | null> {
    const [row] = await this.dbClient
      .select()
      .from(schema.lessons)
      .where(and(eq(schema.lessons.id, lessonId), eq(schema.lessons.userId, userId)))
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
    status: "pending" | "running" | "succeeded" | "failed",
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
    await this.dbClient.transaction(async (tx: any) => {
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
            senseKey: this.textProcessor.buildSenseKey(phrase.phrase, phrase.meaningVi, phrase.category),
            meaningVi: phrase.meaningVi,
            meaningInContextVi: phrase.meaningInContextVi,
            exampleEn: phrase.exampleEn,
            exampleVi: phrase.exampleVi,
            examples: phrase.examples ?? [],
            literalTranslationVi: phrase.literalTranslationVi || null,
            naturalTranslationVi: phrase.naturalTranslationVi || null,
            whyConfusingVi: phrase.whyConfusingVi || null,
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
            naturalMeaningVi: breakdown.naturalMeaningVi,
            structureNotesVi: breakdown.structureNotesVi,
            toneOrContextVi: breakdown.toneOrContextVi ?? null,
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
    exercises: SaveExercisesInput,
    model: string
  ): Promise<void> {
    const phrases: DbKeyPhrase[] = await this.dbClient
      .select()
      .from(schema.keyPhrases)
      .where(eq(schema.keyPhrases.lessonId, lessonId));

    const lessonFocuses: DbLessonFocus[] = await this.dbClient
      .select()
      .from(schema.lessonFocuses)
      .where(eq(schema.lessonFocuses.lessonId, lessonId));

    const phraseByNormalized = new Map<string, DbKeyPhrase>(
      phrases.map((phrase: DbKeyPhrase) => [this.textProcessor.normalizePhrase(phrase.phrase), phrase])
    );

    await this.dbClient.transaction(async (tx: any) => {
      await tx.delete(schema.exercises).where(eq(schema.exercises.lessonId, lessonId));
      if (exercises.exercises.length) {
        await tx.insert(schema.exercises).values(
          exercises.exercises.map((exercise, index) => {
            const keyPhrase = exercise.phrase ? phraseByNormalized.get(this.textProcessor.normalizePhrase(exercise.phrase)) : undefined;
            const lessonFocus = exercise.focus ? findMatchingLessonFocus(exercise.focus, lessonFocuses, this.textProcessor) : undefined;
            return {
              lessonId,
              userId,
              keyPhraseId: keyPhrase?.id ?? null,
              lessonFocusId: lessonFocus?.id ?? null,
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
    const [lesson] = await this.dbClient.select().from(schema.lessons).where(eq(schema.lessons.id, lessonId)).limit(1);
    if (!lesson?.summaryVi || !lesson.naturalTranslationVi || !lesson.contextExplanationVi || !lesson.detectedLevel) {
      throw new Error("Lesson analysis is incomplete.");
    }
    const phrases = await this.dbClient
      .select()
      .from(schema.keyPhrases)
      .where(eq(schema.keyPhrases.lessonId, lessonId))
      .orderBy(asc(schema.keyPhrases.createdAt));
    const lessonFocuses = await this.dbClient
      .select()
      .from(schema.lessonFocuses)
      .where(eq(schema.lessonFocuses.lessonId, lessonId))
      .orderBy(asc(schema.lessonFocuses.createdAt));
    const sentenceBreakdowns = await this.dbClient
      .select()
      .from(schema.sentenceBreakdowns)
      .where(eq(schema.sentenceBreakdowns.lessonId, lessonId))
      .orderBy(schema.sentenceBreakdowns.orderIndex);

    return {
      title: lesson.title,
      textType: lesson.textType as any,
      inputMode: lesson.inputMode,
      detectedLevel: lesson.detectedLevel as any,
      summaryVi: lesson.summaryVi,
      naturalTranslationVi: lesson.naturalTranslationVi,
      contextExplanationVi: lesson.contextExplanationVi,
      sentenceBreakdowns: sentenceBreakdowns.map((breakdown: DbSentenceBreakdown) => ({
        sentence: breakdown.sentence,
        correctedSentenceEn: breakdown.correctedSentenceEn ?? undefined,
        naturalMeaningVi: breakdown.naturalMeaningVi,
        structureNotesVi: breakdown.structureNotesVi,
        toneOrContextVi: breakdown.toneOrContextVi ?? undefined,
      })),
      keyPhrases: phrases.map((phrase: DbKeyPhrase) => ({
        phrase: phrase.phrase,
        conceptKey: phrase.conceptKey,
        conceptPhrase: phrase.conceptPhrase,
        conceptMeaningVi: phrase.conceptMeaningVi,
        meaningVi: phrase.meaningVi,
        meaningInContextVi: phrase.meaningInContextVi ?? "",
        exampleEn: phrase.exampleEn ?? phrase.phrase,
        exampleVi: phrase.exampleVi ?? phrase.meaningInContextVi ?? "",
        examples: phrase.examples ?? [],
        literalTranslationVi: phrase.literalTranslationVi ?? undefined,
        naturalTranslationVi: phrase.naturalTranslationVi ?? undefined,
        whyConfusingVi: phrase.whyConfusingVi ?? undefined,
        category: phrase.category,
        difficulty: phrase.difficulty as any,
      })),
      lessonFocuses: lessonFocuses.map((focus: DbLessonFocus) => ({
        title: focus.title,
        conceptKey: focus.conceptKey,
        conceptPhrase: focus.conceptPhrase,
        conceptMeaningVi: focus.conceptMeaningVi,
        category: focus.category,
        explanationVi: focus.explanationVi,
        difficulty: focus.difficulty as any,
      })),
    };
  }

  private async getLessonProgressHelper(lessonId: string, userId: string): Promise<any> {
    const [lesson] = await this.dbClient
      .select({
        id: schema.lessons.id,
        analysisStatus: schema.lessons.analysisStatus,
        exerciseStatus: schema.lessons.exerciseStatus,
      })
      .from(schema.lessons)
      .where(and(eq(schema.lessons.id, lessonId), eq(schema.lessons.userId, userId)))
      .limit(1);
    if (!lesson) return null;

    const jobs = (await this.dbClient
      .select()
      .from(schema.generationJobs)
      .where(and(eq(schema.generationJobs.lessonId, lessonId), eq(schema.generationJobs.userId, userId)))
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

  async getLessonAggregate(lessonId: string, userId: string): Promise<LessonAggregate | null> {
    const [lesson] = await this.dbClient
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
      this.dbClient
        .select()
        .from(schema.sourceTexts)
        .where(and(eq(schema.sourceTexts.id, lesson.sourceTextId), eq(schema.sourceTexts.userId, userId)))
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
        .from(schema.attempts)
        .where(eq(schema.attempts.lessonId, lesson.id))
        .orderBy(desc(schema.attempts.createdAt)),
      this.dbClient
        .select()
        .from(schema.userErrors)
        .where(eq(schema.userErrors.lessonId, lesson.id)),
      this.getLessonProgressHelper(lesson.id, userId),
    ]);

    const conceptKeys: string[] = Array.from(new Set(userErrors.map((error: { conceptKey: string }) => error.conceptKey)));
    const mistakePatterns = conceptKeys.length
      ? await this.dbClient
          .select()
          .from(schema.mistakePatterns)
          .where(and(eq(schema.mistakePatterns.userId, userId), inArray(schema.mistakePatterns.conceptKey, conceptKeys)))
      : [];

    return {
      lesson: lesson as Lesson,
      sourceText: sourceTextsList[0] ?? null,
      keyPhrases: keyPhrases as KeyPhrase[],
      sentenceBreakdowns: sentenceBreakdowns as SentenceBreakdown[],
      lessonFocuses: lessonFocuses as LessonFocus[],
      exercises: exercises as Exercise[],
      attempts: attempts as any[],
      userErrors: userErrors as any[],
      mistakePatterns: mistakePatterns as any[],
      progress,
    };
  }

  async getRecentLessons(
    userId: string,
    limit: number
  ): Promise<
    Array<{
      id: string;
      title: string | null;
      version: number;
      analysisStatus: "pending" | "running" | "succeeded" | "failed";
      exerciseStatus: "pending" | "running" | "succeeded" | "failed";
      textType: any;
      inputMode: string;
      detectedLevel: any;
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

    return rows.map((row: any) => ({
      ...row,
      analysisStatus: row.analysisStatus,
      exerciseStatus: row.exerciseStatus,
      textType: row.textType ?? "unknown",
      detectedLevel: row.detectedLevel,
    }));
  }
}
