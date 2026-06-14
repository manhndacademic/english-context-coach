import { and, desc, eq, count, inArray, sql as drizzleSql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getTextProcessor, type TextProcessor } from "@/domain/text";
import type { MistakePattern as DbMistakePattern } from "@/db/schema";
import type {
  SourceTextRepository,
  SourceText,
  TextType,
  DetectedLevel,
} from "../ports";

/**
 * Drizzle implementation of `SourceTextRepository`.
 * Manages the SourceText entity lifecycle: creation, lookup, deletion, and user text listing.
 */
export class DrizzleSourceTextRepository implements SourceTextRepository {
  constructor(
    private dbClient: any = db,
    private textProcessor: TextProcessor = getTextProcessor()
  ) {}

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
    const lessons = await this.dbClient
      .select({ id: schema.lessons.id })
      .from(schema.lessons)
      .where(
        and(
          eq(schema.lessons.sourceTextId, sourceTextId),
          eq(schema.lessons.userId, userId)
        )
      );

    const lessonIds = lessons.map((lesson: { id: string }) => lesson.id);
    if (lessonIds.length) {
      const patterns = await this.dbClient
        .select()
        .from(schema.mistakePatterns)
        .where(eq(schema.mistakePatterns.userId, userId));

      const sensitivePatternIds = patterns
        .filter((pattern: DbMistakePattern) =>
          this.textProcessor.shouldScrubMistakePattern({
            phrase: pattern.normalizedPhrase,
            meaningVi: pattern.meaningVi,
            safeReviewPromptVi: pattern.safeReviewPromptVi,
          })
        )
        .map((pattern: DbMistakePattern) => pattern.id);

      if (sensitivePatternIds.length > 0) {
        await this.dbClient
          .delete(schema.mistakePatterns)
          .where(inArray(schema.mistakePatterns.id, sensitivePatternIds));
      }
    }

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
      textType: TextType | "unknown";
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

    return rows.map((row: any) => ({
      ...row,
      textType: row.textType ?? "unknown",
    }));
  }
}
