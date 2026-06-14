import { and, eq, or, count } from "drizzle-orm";
import { db, schema, sql as rawSql, notifyJobQueued } from "@/db";
import type { GenerationJobRepository, GenerationJob } from "../ports";

export class DrizzleGenerationJobRepository implements GenerationJobRepository {
  constructor(private dbClient: any = db) {}

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
    const job = rows[0] as typeof schema.generationJobs.$inferSelect | undefined;
    return (job as GenerationJob) ?? null;
  }

  async updateJobStatus(
    jobId: string,
    status: "queued" | "running" | "succeeded" | "failed",
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

    if (status === "queued") {
      await notifyJobQueued();
    }
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
    await this.dbClient.transaction(async (tx: any) => {
      await tx
        .update(schema.lessons)
        .set({
          analysisStatus: "pending",
          exerciseStatus: "pending",
          updatedAt: new Date(),
        })
        .where(and(eq(schema.lessons.id, lessonId), eq(schema.lessons.userId, userId)));

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
}
