import { and, desc, eq, gt, sql as drizzleSql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { getTextProcessor, type TextProcessor } from "@/domain/text";
import {
  sanitizeGenerationThought,
  selectDisplayGenerationJob,
  type GenerationMilestoneCode,
  type GenerationStage,
} from "@/domain/generation-progress";
import type {
  GenerationProgressRepository,
  GenerationJob,
  GenerationMilestone,
  GenerationThought,
} from "../ports";

export class DrizzleGenerationProgressRepository implements GenerationProgressRepository {
  constructor(
    private dbClient: any = db,
    private textProcessor: TextProcessor = getTextProcessor()
  ) {}

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
      .where(eq(schema.generationThoughts.generationJobId, input.generationJobId))
      .orderBy(desc(schema.generationThoughts.id))
      .limit(1);
    if (latest?.text === text) return;

    await this.dbClient
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
    const [lesson] = await this.dbClient
      .select({
        id: schema.lessons.id,
        analysisStatus: schema.lessons.analysisStatus,
        exerciseStatus: schema.lessons.exerciseStatus,
      })
      .from(schema.lessons)
      .where(and(eq(schema.lessons.id, input.lessonId), eq(schema.lessons.userId, input.userId)))
      .limit(1);
    if (!lesson) return null;

    const jobs = (await this.dbClient
      .select()
      .from(schema.generationJobs)
      .where(and(eq(schema.generationJobs.lessonId, input.lessonId), eq(schema.generationJobs.userId, input.userId)))
      .orderBy(desc(schema.generationJobs.createdAt))) as GenerationJob[];
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
        analysisStatus: lesson.analysisStatus as "pending" | "running" | "succeeded" | "failed",
        exerciseStatus: lesson.exerciseStatus as "pending" | "running" | "succeeded" | "failed",
      },
      job: job ?? null,
      milestones: milestones as GenerationMilestone[],
      thoughts: thoughts as GenerationThought[],
    };
  }
}
