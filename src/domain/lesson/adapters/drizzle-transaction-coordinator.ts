import { eq } from "drizzle-orm";
import { db, schema, notifyJobQueued } from "@/db";
import { getTextProcessor, type TextProcessor } from "@/domain/text";
import { DrizzleSourceTextRepository } from "./drizzle-source-text-repo";
import { DrizzleLessonRepository } from "./drizzle-lesson-repo";
import { DrizzleGenerationJobRepository } from "./drizzle-generation-job-repo";
import { DrizzleGenerationProgressRepository } from "./drizzle-generation-progress-repo";
import type {
  LessonTransactionCoordinator,
  SourceTextRepository,
  LessonRepository,
  GenerationJobRepository,
  GenerationProgressRepository,
  Lesson,
  GenerationJob,
} from "../ports";

export class DrizzleLessonTransactionCoordinator implements LessonTransactionCoordinator {
  constructor(
    private dbClient: any = db,
    private textProcessor: TextProcessor = getTextProcessor()
  ) {}

  async runInTransaction<T>(
    operation: (repos: {
      sourceTexts: SourceTextRepository;
      lessons: LessonRepository;
      generationJobs: GenerationJobRepository;
      generationProgress: GenerationProgressRepository;
    }) => Promise<T>
  ): Promise<T> {
    if (typeof this.dbClient.transaction === "function") {
      return await this.dbClient.transaction(async (drizzleTx: any) => {
        return await operation({
          sourceTexts: new DrizzleSourceTextRepository(drizzleTx, this.textProcessor),
          lessons: new DrizzleLessonRepository(drizzleTx, this.textProcessor),
          generationJobs: new DrizzleGenerationJobRepository(drizzleTx),
          generationProgress: new DrizzleGenerationProgressRepository(drizzleTx, this.textProcessor),
        });
      });
    }
    return await operation({
      sourceTexts: new DrizzleSourceTextRepository(this.dbClient, this.textProcessor),
      lessons: new DrizzleLessonRepository(this.dbClient, this.textProcessor),
      generationJobs: new DrizzleGenerationJobRepository(this.dbClient),
      generationProgress: new DrizzleGenerationProgressRepository(this.dbClient, this.textProcessor),
    });
  }

  async createSourceTextAndLessonAndJob(
    userId: string,
    content: string,
    title: string,
    contentHash: string,
    requestedMode?: string
  ): Promise<{ lesson: Lesson; job: GenerationJob }> {
    const result = await this.dbClient.transaction(async (tx: any) => {
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
          inputMode: requestedMode || "understand_and_practice",
          analysisStatus: "pending",
          exerciseStatus: "pending",
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
    });
    await notifyJobQueued();
    return result as { lesson: Lesson; job: GenerationJob };
  }

  async createLessonAndJob(
    userId: string,
    sourceTextId: string,
    version: number,
    stage: "analysis" | "exercises"
  ): Promise<{ lesson: Lesson; job: GenerationJob }> {
    const result = await this.dbClient.transaction(async (tx: any) => {
      const [lesson] = await tx
        .insert(schema.lessons)
        .values({
          sourceTextId,
          userId,
          version,
          title: `Regeneration ${version}`,
          analysisStatus: "pending",
          exerciseStatus: "pending",
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
    });
    await notifyJobQueued();
    return result as { lesson: Lesson; job: GenerationJob };
  }

  async createJob(
    userId: string,
    sourceTextId: string,
    lessonId: string,
    stage: "analysis" | "exercises"
  ): Promise<GenerationJob> {
    const result = await this.dbClient.transaction(async (tx: any) => {
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
          .set({ analysisStatus: "pending", exerciseStatus: "pending", updatedAt: new Date() })
          .where(eq(schema.lessons.id, lessonId));
      } else {
        await tx
          .update(schema.lessons)
          .set({ exerciseStatus: "pending", updatedAt: new Date() })
          .where(eq(schema.lessons.id, lessonId));
      }

      return job;
    });
    await notifyJobQueued();
    return result as GenerationJob;
  }
}
