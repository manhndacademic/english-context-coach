import { and, asc, count, desc, eq, sql as drizzleSql } from "drizzle-orm";
import { db, schema, sql as rawSql } from "@/db";
import { PROMPT_VERSIONS, SOURCE_TEXT_MAX_LENGTH } from "@/domain/constants";
import {
  buildSenseKey,
  hashText,
  normalizePhrase,
  normalizeSourceText,
} from "@/domain/text";
import {
  assertCompleteExercises,
  prepareAnalysisForSave,
} from "@/domain/lesson";
import {
  containsSourceIdentifyingContent,
  genericSafeReviewExplanationVi,
  genericSafeReviewMeaningVi,
} from "@/domain/privacy";
import { analysisPrompt, exercisesPrompt } from "@/lib/ai/prompts";
import {
  analysisSchema,
  exercisesSchema,
  type AnalysisResult,
} from "@/lib/ai/schemas";
import { generateJson } from "@/lib/ai/provider";
import { recordGenerationMilestone } from "@/lib/jobs/progress";

export type EnqueueResult =
  | { ok: true; lessonId: string }
  | { ok: false; error: string };

export function validateSourceContent(content: string) {
  const normalized = normalizeSourceText(content);
  if (!normalized) return "Paste some English text first.";
  if (normalized.length > SOURCE_TEXT_MAX_LENGTH) {
    return `Source text must be ${SOURCE_TEXT_MAX_LENGTH.toLocaleString()} characters or less.`;
  }
  return null;
}

async function assertQueueCapacity(userId: string) {
  const [running] = await db
    .select({ value: count() })
    .from(schema.generationJobs)
    .where(
      and(
        eq(schema.generationJobs.userId, userId),
        eq(schema.generationJobs.status, "running"),
      ),
    );
  if ((running?.value ?? 0) >= 1)
    return "You already have a generation job running.";

  const [queued] = await db
    .select({ value: count() })
    .from(schema.generationJobs)
    .where(
      and(
        eq(schema.generationJobs.userId, userId),
        eq(schema.generationJobs.status, "queued"),
      ),
    );
  if ((queued?.value ?? 0) >= 3)
    return "You already have three queued generation jobs.";

  return null;
}

export async function createSourceTextAndQueueLesson(input: {
  userId: string;
  content: string;
}): Promise<EnqueueResult> {
  const validationError = validateSourceContent(input.content);
  if (validationError) return { ok: false, error: validationError };

  const capacityError = await assertQueueCapacity(input.userId);
  if (capacityError) return { ok: false, error: capacityError };

  const content = normalizeSourceText(input.content);
  const contentHash = hashText(content);

  const result = await db.transaction(async (tx) => {
    const [sourceText] = await tx
      .insert(schema.sourceTexts)
      .values({
        userId: input.userId,
        title: "Untitled source",
        content,
        contentHash,
      })
      .returning();

    const [lesson] = await tx
      .insert(schema.lessons)
      .values({
        sourceTextId: sourceText.id,
        userId: input.userId,
        version: 1,
        title: "Generating lesson",
        analysisStatus: "pending",
        exerciseStatus: "pending",
      })
      .returning();

    const [job] = await tx
      .insert(schema.generationJobs)
      .values({
        userId: input.userId,
        sourceTextId: sourceText.id,
        lessonId: lesson.id,
        status: "queued",
        stage: "analysis",
      })
      .returning();

    return { lesson, job };
  });

  await recordGenerationMilestone({
    lessonId: result.lesson.id,
    generationJobId: result.job.id,
    code: "queued",
    stage: null,
  });

  return { ok: true, lessonId: result.lesson.id };
}

export async function queueLessonRegeneration(input: {
  userId: string;
  sourceTextId: string;
}): Promise<EnqueueResult> {
  const capacityError = await assertQueueCapacity(input.userId);
  if (capacityError) return { ok: false, error: capacityError };

  const [sourceText] = await db
    .select()
    .from(schema.sourceTexts)
    .where(
      and(
        eq(schema.sourceTexts.id, input.sourceTextId),
        eq(schema.sourceTexts.userId, input.userId),
        drizzleSql`${schema.sourceTexts.deletedAt} is null`,
      ),
    )
    .limit(1);
  if (!sourceText) return { ok: false, error: "Source text not found." };

  const [latest] = await db
    .select()
    .from(schema.lessons)
    .where(eq(schema.lessons.sourceTextId, input.sourceTextId))
    .orderBy(desc(schema.lessons.version))
    .limit(1);

  const nextVersion = (latest?.version ?? 0) + 1;
  const [lesson] = await db
    .insert(schema.lessons)
    .values({
      sourceTextId: input.sourceTextId,
      userId: input.userId,
      version: nextVersion,
      title: `Regeneration ${nextVersion}`,
      analysisStatus: "pending",
      exerciseStatus: "pending",
    })
    .returning();

  const [job] = await db
    .insert(schema.generationJobs)
    .values({
      userId: input.userId,
      sourceTextId: input.sourceTextId,
      lessonId: lesson.id,
      status: "queued",
      stage: "analysis",
    })
    .returning();

  await recordGenerationMilestone({
    lessonId: lesson.id,
    generationJobId: job.id,
    code: "queued",
    stage: null,
  });

  return { ok: true, lessonId: lesson.id };
}

export async function queueExerciseRetry(input: {
  userId: string;
  lessonId: string;
}): Promise<EnqueueResult> {
  const capacityError = await assertQueueCapacity(input.userId);
  if (capacityError) return { ok: false, error: capacityError };

  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(
      and(
        eq(schema.lessons.id, input.lessonId),
        eq(schema.lessons.userId, input.userId),
      ),
    )
    .limit(1);
  if (!lesson) return { ok: false, error: "Lesson not found." };
  if (lesson.analysisStatus !== "succeeded")
    return { ok: false, error: "Analysis must finish before exercises." };

  const [job] = await db
    .insert(schema.generationJobs)
    .values({
      userId: input.userId,
      sourceTextId: lesson.sourceTextId,
      lessonId: lesson.id,
      status: "queued",
      stage: "exercises",
    })
    .returning();
  await db
    .update(schema.lessons)
    .set({ exerciseStatus: "pending" })
    .where(eq(schema.lessons.id, lesson.id));

  await recordGenerationMilestone({
    lessonId: lesson.id,
    generationJobId: job.id,
    code: "queued",
    stage: null,
  });

  return { ok: true, lessonId: lesson.id };
}

export async function queueFailedLessonRetry(input: {
  userId: string;
  lessonId: string;
}): Promise<EnqueueResult> {
  const capacityError = await assertQueueCapacity(input.userId);
  if (capacityError) return { ok: false, error: capacityError };

  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(
      and(
        eq(schema.lessons.id, input.lessonId),
        eq(schema.lessons.userId, input.userId),
      ),
    )
    .limit(1);
  if (!lesson) return { ok: false, error: "Lesson not found." };

  const stage =
    lesson.analysisStatus === "failed"
      ? "analysis"
      : lesson.exerciseStatus === "failed"
        ? "exercises"
        : null;
  if (!stage)
    return {
      ok: false,
      error: "Lesson does not have a failed generation stage.",
    };

  const job = await db.transaction(async (tx) => {
    const [createdJob] = await tx
      .insert(schema.generationJobs)
      .values({
        userId: input.userId,
        sourceTextId: lesson.sourceTextId,
        lessonId: lesson.id,
        status: "queued",
        stage,
      })
      .returning();

    await tx
      .update(schema.lessons)
      .set({
        analysisStatus:
          stage === "analysis" ? "pending" : lesson.analysisStatus,
        exerciseStatus: stage === "analysis" ? "pending" : "pending",
        updatedAt: new Date(),
      })
      .where(eq(schema.lessons.id, lesson.id));

    return createdJob;
  });

  await recordGenerationMilestone({
    lessonId: lesson.id,
    generationJobId: job.id,
    code: "queued",
    stage: null,
  });

  return { ok: true, lessonId: lesson.id };
}

export async function claimGenerationJob(workerId: string) {
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
  if (job) {
    await recordGenerationMilestone({
      lessonId: job.lessonId,
      generationJobId: job.id,
      code: "claimed",
      stage: null,
    });
  }

  return job;
}

async function saveAnalysis(input: {
  lessonId: string;
  userId: string;
  analysis: AnalysisResult;
  model: string;
}) {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.lessons)
      .set({
        title: input.analysis.title,
        textType: input.analysis.textType,
        detectedLevel: input.analysis.detectedLevel,
        summaryVi: input.analysis.summaryVi,
        naturalTranslationVi: input.analysis.naturalTranslationVi,
        contextExplanationVi: input.analysis.contextExplanationVi,
        analysisStatus: "succeeded",
        analysisPromptVersion: PROMPT_VERSIONS.analysis,
        analysisModel: input.model,
        updatedAt: new Date(),
      })
      .where(eq(schema.lessons.id, input.lessonId));

    if (input.analysis.keyPhrases.length) {
      await tx.insert(schema.keyPhrases).values(
        input.analysis.keyPhrases.map((phrase) => ({
          lessonId: input.lessonId,
          userId: input.userId,
          phrase: phrase.phrase,
          normalizedPhrase: normalizePhrase(phrase.phrase),
          senseKey: buildSenseKey(
            phrase.phrase,
            phrase.meaningVi,
            phrase.category,
          ),
          meaningVi: phrase.meaningVi,
          meaningInContextVi: phrase.meaningInContextVi,
          literalTranslationVi: phrase.literalTranslationVi,
          naturalTranslationVi: phrase.naturalTranslationVi,
          whyConfusingVi: phrase.whyConfusingVi,
          category: phrase.category,
          difficulty: phrase.difficulty,
          isSensitive:
            containsSourceIdentifyingContent(phrase.phrase) ||
            containsSourceIdentifyingContent(phrase.meaningVi) ||
            containsSourceIdentifyingContent(phrase.meaningInContextVi),
        })),
      );
    }

    await tx.insert(schema.lessonFocuses).values(
      input.analysis.lessonFocuses.map((focus) => ({
        lessonId: input.lessonId,
        userId: input.userId,
        title: focus.title,
        category: focus.category,
        explanationVi: focus.explanationVi,
        difficulty: focus.difficulty,
      })),
    );
  });
}

async function buildAnalysisFromLesson(
  lessonId: string,
): Promise<AnalysisResult> {
  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(eq(schema.lessons.id, lessonId))
    .limit(1);
  if (
    !lesson?.summaryVi ||
    !lesson.naturalTranslationVi ||
    !lesson.contextExplanationVi ||
    !lesson.detectedLevel
  ) {
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

  return {
    title: lesson.title,
    textType: lesson.textType,
    detectedLevel: lesson.detectedLevel,
    summaryVi: lesson.summaryVi,
    naturalTranslationVi: lesson.naturalTranslationVi,
    contextExplanationVi: lesson.contextExplanationVi,
    keyPhrases: phrases.map((phrase) => ({
      phrase: phrase.phrase,
      meaningVi: phrase.meaningVi,
      meaningInContextVi: phrase.meaningInContextVi,
      literalTranslationVi: phrase.literalTranslationVi ?? undefined,
      naturalTranslationVi: phrase.naturalTranslationVi ?? undefined,
      whyConfusingVi: phrase.whyConfusingVi ?? undefined,
      category: phrase.category,
      difficulty: phrase.difficulty,
    })),
    lessonFocuses: lessonFocuses.map((focus) => ({
      title: focus.title,
      category: focus.category,
      explanationVi: focus.explanationVi,
      difficulty: focus.difficulty,
    })),
  };
}

async function saveExercises(input: {
  lessonId: string;
  userId: string;
  result: Awaited<ReturnType<typeof exercisesSchema.parse>>;
  model: string;
}) {
  const phrases = await db
    .select()
    .from(schema.keyPhrases)
    .where(eq(schema.keyPhrases.lessonId, input.lessonId));
  const lessonFocuses = await db
    .select()
    .from(schema.lessonFocuses)
    .where(eq(schema.lessonFocuses.lessonId, input.lessonId));
  const phraseByNormalized = new Map(
    phrases.map((phrase) => [normalizePhrase(phrase.phrase), phrase]),
  );
  const focusByNormalized = new Map(
    lessonFocuses.map((focus) => [normalizePhrase(focus.title), focus]),
  );

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.exercises)
      .where(eq(schema.exercises.lessonId, input.lessonId));
    await tx.insert(schema.exercises).values(
      input.result.exercises.map((exercise, index) => {
        const keyPhrase =
          "phrase" in exercise
            ? phraseByNormalized.get(normalizePhrase(exercise.phrase))
            : undefined;
        const lessonFocus =
          "focus" in exercise
            ? focusByNormalized.get(normalizePhrase(exercise.focus))
            : undefined;
        return {
          lessonId: input.lessonId,
          userId: input.userId,
          keyPhraseId: keyPhrase?.id,
          lessonFocusId: lessonFocus?.id,
          type: exercise.type,
          promptVi: exercise.promptVi,
          promptEn: "promptEn" in exercise ? exercise.promptEn : undefined,
          choices: "choices" in exercise ? exercise.choices : undefined,
          correctAnswer:
            "correctAnswer" in exercise ? exercise.correctAnswer : undefined,
          acceptableAnswers:
            "acceptableAnswers" in exercise
              ? exercise.acceptableAnswers
              : undefined,
          rubricVi: "rubricVi" in exercise ? exercise.rubricVi : undefined,
          orderIndex: index,
        };
      }),
    );
    await tx
      .update(schema.lessons)
      .set({
        exerciseStatus: "succeeded",
        exercisePromptVersion: PROMPT_VERSIONS.exercises,
        exerciseModel: input.model,
        updatedAt: new Date(),
      })
      .where(eq(schema.lessons.id, input.lessonId));
  });
}

export async function processGenerationJob(
  job: typeof schema.generationJobs.$inferSelect,
) {
  let currentStage = job.stage;
  try {
    const [sourceText] = await db
      .select()
      .from(schema.sourceTexts)
      .where(eq(schema.sourceTexts.id, job.sourceTextId))
      .limit(1);
    if (!sourceText || sourceText.deletedAt)
      throw new Error("Source text is unavailable.");

    if (job.stage === "analysis") {
      await db
        .update(schema.lessons)
        .set({ analysisStatus: "running" })
        .where(eq(schema.lessons.id, job.lessonId));
      await recordGenerationMilestone({
        lessonId: job.lessonId,
        generationJobId: job.id,
        code: "analysis_started",
        stage: "analysis",
      });
      const result = await generateJson({
        userId: job.userId,
        lessonId: job.lessonId,
        purpose: "analysis",
        prompt: analysisPrompt(sourceText.content),
        promptVersion: PROMPT_VERSIONS.analysis,
        schemaVersion: "analysis",
        schema: analysisSchema,
        modelKind: "analysis",
      });
      const analysis = prepareAnalysisForSave(result, sourceText.content);
      await recordGenerationMilestone({
        lessonId: job.lessonId,
        generationJobId: job.id,
        code: "saving_analysis",
        stage: "analysis",
      });
      await saveAnalysis({
        lessonId: job.lessonId,
        userId: job.userId,
        analysis,
        model: process.env.GEMINI_ANALYSIS_MODEL ?? "gemini-3.1-pro-preview",
      });
      await recordGenerationMilestone({
        lessonId: job.lessonId,
        generationJobId: job.id,
        code: "analysis_saved",
        stage: "analysis",
      });
      await db
        .update(schema.generationJobs)
        .set({ stage: "exercises" })
        .where(eq(schema.generationJobs.id, job.id));
      currentStage = "exercises";
    }

    await db
      .update(schema.lessons)
      .set({ exerciseStatus: "running" })
      .where(eq(schema.lessons.id, job.lessonId));
    await recordGenerationMilestone({
      lessonId: job.lessonId,
      generationJobId: job.id,
      code: "exercises_started",
      stage: "exercises",
    });
    const analysis = await buildAnalysisFromLesson(job.lessonId);
    let exercises: Awaited<ReturnType<typeof exercisesSchema.parse>> | null =
      null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const candidate = await generateJson({
        userId: job.userId,
        lessonId: job.lessonId,
        purpose: "exercise_generation",
        prompt: exercisesPrompt(analysis),
        promptVersion: PROMPT_VERSIONS.exercises,
        schemaVersion: "exercises",
        schema: exercisesSchema,
        modelKind: "fast",
      });

      try {
        assertCompleteExercises(candidate, analysis);
        await recordGenerationMilestone({
          lessonId: job.lessonId,
          generationJobId: job.id,
          code: "validating_lesson",
          stage: "exercises",
        });
        exercises = candidate;
        break;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
    if (!exercises)
      throw new Error("Exercise generation did not return a complete Lesson.");
    await saveExercises({
      lessonId: job.lessonId,
      userId: job.userId,
      result: exercises,
      model: process.env.GEMINI_FAST_MODEL ?? "gemini-3.5-flash",
    });
    await recordGenerationMilestone({
      lessonId: job.lessonId,
      generationJobId: job.id,
      code: "exercises_saved",
      stage: "exercises",
    });
    await db
      .update(schema.generationJobs)
      .set({ status: "succeeded", errorMessage: null, updatedAt: new Date() })
      .where(eq(schema.generationJobs.id, job.id));
    await recordGenerationMilestone({
      lessonId: job.lessonId,
      generationJobId: job.id,
      code: "completed",
      stage: null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown generation error";
    const transient = isTransientGenerationError(error);
    if (transient && job.attempts < 3) {
      const retryStatusUpdate =
        currentStage === "analysis"
          ? { analysisStatus: "pending" as const, updatedAt: new Date() }
          : { exerciseStatus: "pending" as const, updatedAt: new Date() };
      await db
        .update(schema.lessons)
        .set(retryStatusUpdate)
        .where(eq(schema.lessons.id, job.lessonId));
      await db
        .update(schema.generationJobs)
        .set({
          status: "queued",
          stage: currentStage,
          errorMessage: message,
          lockedAt: null,
          lockedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.generationJobs.id, job.id));
      await recordGenerationMilestone({
        lessonId: job.lessonId,
        generationJobId: job.id,
        code: "retrying",
        stage:
          currentStage === "analysis" || currentStage === "exercises"
            ? currentStage
            : null,
      });
      throw error;
    }

    const failedStage =
      currentStage === "analysis" ? "analysisStatus" : "exerciseStatus";
    await db
      .update(schema.lessons)
      .set({ [failedStage]: "failed", updatedAt: new Date() })
      .where(eq(schema.lessons.id, job.lessonId));
    await db
      .update(schema.generationJobs)
      .set({
        status: "failed",
        stage: currentStage,
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(schema.generationJobs.id, job.id));
    await recordGenerationMilestone({
      lessonId: job.lessonId,
      generationJobId: job.id,
      code: "failed",
      stage:
        currentStage === "analysis" || currentStage === "exercises"
          ? currentStage
          : null,
    });
    throw error;
  }
}

function isTransientGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ECONNRESET") ||
    message.includes("socket connection was closed") ||
    message.includes('"code":429') ||
    message.includes("Too Many Requests") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes('"code":503') ||
    message.includes("UNAVAILABLE") ||
    message.includes("high demand")
  );
}

export async function deleteSourceTextWithPrivacy(input: {
  userId: string;
  sourceTextId: string;
}) {
  await db.transaction(async (tx) => {
    const [sourceText] = await tx
      .select({ id: schema.sourceTexts.id })
      .from(schema.sourceTexts)
      .where(
        and(
          eq(schema.sourceTexts.id, input.sourceTextId),
          eq(schema.sourceTexts.userId, input.userId),
        ),
      )
      .limit(1);
    if (!sourceText) return;

    const affectedPatterns = await tx
      .select({ id: schema.mistakeEvidence.mistakePatternId })
      .from(schema.mistakeEvidence)
      .where(
        and(
          eq(schema.mistakeEvidence.sourceTextId, input.sourceTextId),
          eq(schema.mistakeEvidence.userId, input.userId),
        ),
      );
    const affectedConcepts = await tx
      .select({ id: schema.mistakeEvidence.mistakeConceptId })
      .from(schema.mistakeEvidence)
      .where(
        and(
          eq(schema.mistakeEvidence.sourceTextId, input.sourceTextId),
          eq(schema.mistakeEvidence.userId, input.userId),
        ),
      );

    await tx
      .delete(schema.mistakeEvidence)
      .where(
        and(
          eq(schema.mistakeEvidence.sourceTextId, input.sourceTextId),
          eq(schema.mistakeEvidence.userId, input.userId),
        ),
      );

    for (const pattern of affectedPatterns) {
      await tx.execute(drizzleSql`
        update mistake_patterns
        set occurrence_count = remaining.remaining_count,
            safe_review_prompt_vi = 'Ôn lại điểm nghĩa này theo cách tự nhiên trong ngữ cảnh.',
            updated_at = now()
        from (
          select mistake_pattern_id, count(*)::integer as remaining_count
          from mistake_evidence
          where mistake_pattern_id = ${pattern.id}
          group by mistake_pattern_id
        ) remaining
        where mistake_patterns.id = remaining.mistake_pattern_id
          and mistake_patterns.user_id = ${input.userId}
      `);
    }

    for (const concept of affectedConcepts) {
      await tx.execute(drizzleSql`
        update mistake_concepts
        set title_vi = 'Ôn lại một điểm nghĩa trong ngữ cảnh',
            explanation_vi = ${genericSafeReviewExplanationVi},
            safe_review_seed = jsonb_build_object(
              'meaningVi', ${genericSafeReviewMeaningVi},
              'explanationVi', ${genericSafeReviewExplanationVi},
              'category', mistake_concepts.category,
              'errorType', mistake_concepts.error_type::text
            ),
            updated_at = now()
        where mistake_concepts.id = ${concept.id}
          and mistake_concepts.user_id = ${input.userId}
          and exists (
            select 1 from mistake_evidence
            where mistake_evidence.mistake_concept_id = mistake_concepts.id
          )
      `);
    }

    await tx.execute(drizzleSql`
      delete from mistake_patterns
      where user_id = ${input.userId}
        and not exists (
          select 1 from mistake_evidence
          where mistake_evidence.mistake_pattern_id = mistake_patterns.id
        )
    `);

    await tx.execute(drizzleSql`
      delete from mistake_concepts
      where user_id = ${input.userId}
        and not exists (
          select 1 from mistake_evidence
          where mistake_evidence.mistake_concept_id = mistake_concepts.id
        )
    `);

    await tx
      .delete(schema.sourceTexts)
      .where(
        and(
          eq(schema.sourceTexts.id, input.sourceTextId),
          eq(schema.sourceTexts.userId, input.userId),
        ),
      );
  });
}
