import { and, count, eq, sql as drizzleSql, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { getTextProcessor, type TextProcessor } from "@/domain/text";
import type { SourceTextRepository, SourceText } from "../ports";
import type { MistakePattern as DbMistakePattern } from "@/db/schema";

export class DrizzleSourceTextRepository implements SourceTextRepository {
  constructor(
    private dbClient: any = db,
    private textProcessor: TextProcessor = getTextProcessor()
  ) {}

  async findSourceText(sourceTextId: string, userId: string): Promise<SourceText | null> {
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
      .where(and(eq(schema.lessons.sourceTextId, sourceTextId), eq(schema.lessons.userId, userId)));

    const lessonIds = lessons.map((lesson: { id: string }) => lesson.id);
    if (lessonIds.length) {
      const patterns = await this.dbClient
        .select()
        .from(schema.mistakePatterns)
        .where(eq(schema.mistakePatterns.userId, userId));

      const sensitivePatternIds = patterns
        .filter((pattern: DbMistakePattern) =>
          this.textProcessor.shouldScrubMistakePattern({
            normalizedPhrase: pattern.normalizedPhrase,
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
      .where(and(eq(schema.sourceTexts.id, sourceTextId), eq(schema.sourceTexts.userId, userId)));
  }

  async getSourceTextsCount(userId: string): Promise<number> {
    const [row] = await this.dbClient
      .select({ value: count() })
      .from(schema.sourceTexts)
      .where(eq(schema.sourceTexts.userId, userId));
    return row?.value ?? 0;
  }
}
