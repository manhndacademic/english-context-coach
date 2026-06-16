/**
 * addPhrasesToReviewQueue
 *
 * Batch-inserts AI-extracted key phrases into the `mistake_patterns` table
 * as SRS review cards (source = 'phrase').
 *
 * Dedup rule: if a (userId, conceptKey, errorType) pattern already exists
 * (because the user made an actual mistake on this concept), we skip the
 * insert — the mistake-sourced card takes priority. This preserves the
 * higher-signal mistake card while preventing duplicate cards.
 */

import { db } from "@/db";
import { mistakePatterns } from "@/db/schema";
import { MistakePattern } from "@/domain/memory/mistake-pattern";
import { getLogger } from "@/lib/logger";
import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { KeyPhrase } from "@/domain/lesson";

const log = getLogger("c.c.phrases.addPhrasesToReviewQueue");

export async function addPhrasesToReviewQueue(
  userId: string,
  phrases: KeyPhrase[]
): Promise<{ inserted: number; skipped: number }> {
  if (phrases.length === 0) return { inserted: 0, skipped: 0 };

  const conceptKeys = phrases.map((p) => p.conceptKey);

  // Find existing patterns for these concept keys so we can dedup
  const existingRows = await db
    .select({
      conceptKey: mistakePatterns.conceptKey,
    })
    .from(mistakePatterns)
    .where(
      and(
        eq(mistakePatterns.userId, userId),
        inArray(mistakePatterns.conceptKey, conceptKeys)
      )
    );

  const existingConceptKeys = new Set(existingRows.map((r) => r.conceptKey));

  const toInsert = phrases.filter(
    (p) => !existingConceptKeys.has(p.conceptKey)
  );

  if (toInsert.length === 0) {
    log.info(
      `[addPhrasesToReviewQueue] All ${phrases.length} phrases already have SRS cards for user ${userId}. Skipping.`
    );
    return { inserted: 0, skipped: phrases.length };
  }

  const cards = toInsert.map((phrase) =>
    MistakePattern.createFromPhrase({
      id: randomUUID(),
      userId,
      keyPhraseId: phrase.id,
      conceptKey: phrase.conceptKey,
      normalizedPhrase: phrase.normalizedPhrase,
      senseKey: phrase.senseKey,
      category: phrase.category,
      meaningVi: phrase.meaningVi,
      isSensitive: phrase.isSensitive,
    })
  );

  const rows = cards.map((c) => c.toDbRow());

  // Insert all at once, ignoring conflicts on (userId, conceptKey, errorType).
  // toDbRow() returns Record<string, any>; Drizzle's insert accepts typed or any[]
  const typedRows = rows as Parameters<typeof db.insert>[0] extends never
    ? never
    : Parameters<
        ReturnType<typeof db.insert<typeof mistakePatterns>>["values"]
      >[0][];

  await db
    .insert(mistakePatterns)
    .values(typedRows as any[]) // toDbRow() shape matches schema; cast is safe
    .onConflictDoNothing({
      target: [
        mistakePatterns.userId,
        mistakePatterns.conceptKey,
        mistakePatterns.errorType,
      ],
    });

  log.info(
    `[addPhrasesToReviewQueue] Inserted ${toInsert.length} phrase-sourced SRS cards for user ${userId}. Skipped ${phrases.length - toInsert.length} duplicates.`
  );

  return {
    inserted: toInsert.length,
    skipped: phrases.length - toInsert.length,
  };
}
