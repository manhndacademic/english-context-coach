import { db } from "@/db";
import { attempts, reviewAttempts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Returns the LearningStreak for a user: the number of consecutive calendar
 * days (ending today or yesterday) on which the user completed at least one
 * Attempt or ReviewAttempt.
 *
 * A streak resets to 0 when the user skips a full calendar day.
 * If the user only had activity yesterday (not today), the streak is still
 * alive and counted from yesterday.
 */
export async function getLearningStreak(userId: string): Promise<number> {
  // Collect all distinct activity dates from attempts + reviewAttempts
  const attemptDates = await db
    .selectDistinct({
      activityDate: sql<string>`DATE(${attempts.createdAt} AT TIME ZONE 'UTC')`.as("activity_date"),
    })
    .from(attempts)
    .where(eq(attempts.userId, userId));

  const reviewDates = await db
    .selectDistinct({
      activityDate: sql<string>`DATE(${reviewAttempts.createdAt} AT TIME ZONE 'UTC')`.as("activity_date"),
    })
    .from(reviewAttempts)
    .where(eq(reviewAttempts.userId, userId));

  // Merge and deduplicate dates
  const allDateStrings = new Set<string>([
    ...attemptDates.map((r) => r.activityDate),
    ...reviewDates.map((r) => r.activityDate),
  ]);

  if (allDateStrings.size === 0) return 0;

  // Sort descending
  const sortedDates = Array.from(allDateStrings).sort((a, b) =>
    b.localeCompare(a),
  );

  // Compute "today" and "yesterday" in UTC date strings
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date();
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  // Streak must start from today or yesterday; otherwise streak is 0
  if (sortedDates[0] !== todayStr && sortedDates[0] !== yesterdayStr) {
    return 0;
  }

  // Walk backward counting consecutive days
  let streak = 0;
  let expectedDate = sortedDates[0];

  for (const dateStr of sortedDates) {
    if (dateStr === expectedDate) {
      streak++;
      // Move expected date one day earlier
      const d = new Date(expectedDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      expectedDate = d.toISOString().slice(0, 10);
    } else {
      break;
    }
  }

  return streak;
}
