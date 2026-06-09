import { and, desc, eq, gt, type SQL } from "drizzle-orm";
import { db, schema, sql as rawSql } from "@/db";
import {
  type GenerationMilestoneCode,
  type GenerationStage,
  sanitizeGenerationThought,
  selectDisplayGenerationJob,
} from "@/domain/generation-progress";

export async function recordGenerationMilestone(input: {
  lessonId: string;
  generationJobId: string;
  code: GenerationMilestoneCode;
  stage: GenerationStage;
}) {
  const rows = await rawSql`
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
    returning
      id,
      lesson_id as "lessonId",
      generation_job_id as "generationJobId",
      code,
      stage,
      created_at as "createdAt"
  `;

  return rows[0] as typeof schema.generationMilestones.$inferSelect | undefined;
}

export async function recordGenerationThought(input: {
  lessonId: string;
  generationJobId: string;
  stage: GenerationStage;
  text: string;
}) {
  const text = sanitizeGenerationThought(input.text);
  if (!text) return undefined;

  const [latest] = await db
    .select({ text: schema.generationThoughts.text })
    .from(schema.generationThoughts)
    .where(eq(schema.generationThoughts.generationJobId, input.generationJobId))
    .orderBy(desc(schema.generationThoughts.id))
    .limit(1);
  if (latest?.text === text) return undefined;

  const [thought] = await db
    .insert(schema.generationThoughts)
    .values({
      lessonId: input.lessonId,
      generationJobId: input.generationJobId,
      stage: input.stage,
      text,
    })
    .returning();

  return thought;
}

export async function getLessonProgress(input: {
  lessonId: string;
  userId: string;
  afterMilestoneId?: number;
  afterThoughtId?: number;
}) {
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

  return { lesson, job, milestones, thoughts };
}
