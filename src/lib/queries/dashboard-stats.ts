import { db } from "@/db";
import { mistakePatterns, reviewAttempts } from "@/db/schema";
import { eq, and, count, sql } from "drizzle-orm";

export interface WeeklyTrend {
  week: string; // ISO date string for start of week, e.g. "2025-06-09"
  cumulative: number;
}

/**
 * Count of MistakePatterns that have been mastered.
 */
export async function getMasteredCount(userId: string): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(mistakePatterns)
    .where(
      and(
        eq(mistakePatterns.userId, userId),
        eq(mistakePatterns.masteryState, "mastered"),
      ),
    );
  return result[0]?.value ?? 0;
}

/**
 * Percentage of ReviewAttempts that were correct (0–100, rounded).
 * Returns 0 when no reviews have been submitted.
 */
export async function getReviewSuccessRate(userId: string): Promise<number> {
  const rows = await db
    .select({
      total: count(),
      correct: sql<number>`SUM(CASE WHEN ${reviewAttempts.isCorrect} THEN 1 ELSE 0 END)`,
    })
    .from(reviewAttempts)
    .where(eq(reviewAttempts.userId, userId));

  const { total, correct } = rows[0] ?? { total: 0, correct: 0 };
  if (!total) return 0;
  return Math.round((Number(correct) / Number(total)) * 100);
}

/**
 * Weekly cumulative count of mastered MistakePatterns, grouped by ISO week
 * start (Monday). Returns ascending array of { week, cumulative } for use in
 * the dashboard trend chart.
 */
export async function getMasteredTrend(userId: string): Promise<WeeklyTrend[]> {
  // Pull all mastered patterns with their updatedAt date
  const rows = await db
    .select({
      // Truncate to ISO week start (Monday)
      week: sql<string>`TO_CHAR(DATE_TRUNC('week', ${mistakePatterns.updatedAt}), 'YYYY-MM-DD')`,
    })
    .from(mistakePatterns)
    .where(
      and(
        eq(mistakePatterns.userId, userId),
        eq(mistakePatterns.masteryState, "mastered"),
      ),
    )
    .orderBy(mistakePatterns.updatedAt);

  if (rows.length === 0) return [];

  // Group by week and compute cumulative count
  const weekCounts = new Map<string, number>();
  for (const row of rows) {
    weekCounts.set(row.week, (weekCounts.get(row.week) ?? 0) + 1);
  }

  const sortedWeeks = Array.from(weekCounts.keys()).sort();
  let cumulative = 0;
  return sortedWeeks.map((week) => {
    cumulative += weekCounts.get(week)!;
    return { week, cumulative };
  });
}
