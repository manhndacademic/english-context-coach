/**
 * digestWorker
 *
 * Runs once per hour (via BullMQ repeatable cron).
 * For each opted-in user whose emailDigestHour matches the current UTC+7 hour,
 * sends a daily review digest email if they have overdue items.
 */

import { db } from "@/db";
import { users, mistakePatterns } from "@/db/schema";
import { and, eq, lte, count, asc } from "drizzle-orm";
import { sendDigestEmail } from "@/lib/email/sendDigestEmail";
import { getLogger } from "@/lib/logger";

const log = getLogger("c.c.jobs.digestWorker");

/** UTC offset for Vietnam time (UTC+7) */
const VN_UTC_OFFSET_HOURS = 7;

function currentVnHour(): number {
  const utcHour = new Date().getUTCHours();
  return (utcHour + VN_UTC_OFFSET_HOURS) % 24;
}

export async function runDigestWorker(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
}> {
  const currentHour = currentVnHour();
  log.info(`[DigestWorker] Running for VN hour ${currentHour}:00`);

  // Find all users who have digest enabled and prefer this hour
  const eligibleUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailDigestHour: users.emailDigestHour,
    })
    .from(users)
    .where(
      and(
        eq(users.emailDigestEnabled, true),
        eq(users.emailDigestHour, currentHour)
      )
    );

  log.info(
    `[DigestWorker] Found ${eligibleUsers.length} users to process for hour ${currentHour}`
  );

  const results = { processed: 0, sent: 0, skipped: 0, errors: 0 };
  const now = new Date();

  for (const user of eligibleUsers) {
    results.processed++;
    try {
      // Count how many items are due
      const [{ value: dueCount }] = await db
        .select({ value: count() })
        .from(mistakePatterns)
        .where(
          and(
            eq(mistakePatterns.userId, user.id),
            eq(mistakePatterns.masteryState, "active"),
            lte(mistakePatterns.dueAt, now)
          )
        );

      if (!dueCount || dueCount === 0) {
        log.info(`[DigestWorker] No due items for user ${user.id}. Skipping.`);
        results.skipped++;
        continue;
      }

      // Fetch up to 5 preview items (phrase + meaningVi)
      const previewItems = await db
        .select({
          phrase: mistakePatterns.normalizedPhrase,
          meaningVi: mistakePatterns.meaningVi,
        })
        .from(mistakePatterns)
        .where(
          and(
            eq(mistakePatterns.userId, user.id),
            eq(mistakePatterns.masteryState, "active"),
            lte(mistakePatterns.dueAt, now)
          )
        )
        .orderBy(asc(mistakePatterns.dueAt))
        .limit(5);

      await sendDigestEmail({
        to: user.email,
        userName: user.name,
        dueCount,
        items: previewItems,
      });

      results.sent++;
      log.info(
        `[DigestWorker] Sent digest to ${user.email} with ${dueCount} due items`
      );
    } catch (err) {
      results.errors++;
      log.error(
        `[DigestWorker] Failed to send digest to ${user.email}:`,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  log.info(
    `[DigestWorker] Done. processed=${results.processed} sent=${results.sent} skipped=${results.skipped} errors=${results.errors}`
  );

  return results;
}
