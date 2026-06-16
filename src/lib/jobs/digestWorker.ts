/**
 * digestWorker
 *
 * Runs once per hour (via BullMQ repeatable cron).
 * For each opted-in user whose emailDigestHour matches the current UTC+7 hour,
 * sends a daily review digest email if they have overdue items.
 */

import { db } from "@/db";
import { emailDigestLogs, users, mistakePatterns } from "@/db/schema";
import { and, eq, lte, count, asc } from "drizzle-orm";
import { sendDigestEmail } from "@/lib/email/sendDigestEmail";
import { getLogger } from "@/lib/logger";

const log = getLogger("c.c.jobs.digestWorker");
const VN_UTC_OFFSET_HOURS = 7;

function currentVnHour(): number {
  const utcHour = new Date().getUTCHours();
  return (utcHour + VN_UTC_OFFSET_HOURS) % 24;
}

function currentVnDigestDate(now = new Date()): string {
  const vnTime = new Date(now.getTime() + VN_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return vnTime.toISOString().slice(0, 10);
}

export async function runDigestWorker(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
}> {
  const currentHour = currentVnHour();
  const digestDate = currentVnDigestDate();
  log.info(
    `[DigestWorker] Running for VN hour ${currentHour}:00 date=${digestDate}`
  );

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
    let currentDueCount = 0;
    try {
      // 1. Atomically try to claim this user + date
      // We insert a row with status 'processing'.
      // If a row already exists:
      //   - If status is 'failed', we can retry (update to 'processing' and clear error).
      //   - If status is 'sent', 'processing', or 'skipped', we must not process (skip).
      const [claimedLog] = await db
        .insert(emailDigestLogs)
        .values({
          userId: user.id,
          digestDate,
          status: "processing",
          dueCount: 0,
        })
        .onConflictDoUpdate({
          target: [emailDigestLogs.userId, emailDigestLogs.digestDate],
          set: {
            status: "processing",
            errorMessage: null,
            updatedAt: new Date(),
          },
          where: eq(emailDigestLogs.status, "failed"),
        })
        .returning();

      if (!claimedLog) {
        // Claim failed because it was already sent, processing, or skipped.
        results.skipped++;
        log.info(
          `[DigestWorker] Digest for user ${user.id} on ${digestDate} is already sent, processing, or skipped. Skipping.`
        );
        continue;
      }

      // 2. Count due items
      const [{ value: dueCount }] = await db
        .select({ value: count() })
        .from(mistakePatterns)
        .where(
          and(
            eq(mistakePatterns.userId, user.id),
            eq(mistakePatterns.masteryState, "active"),
            lte(mistakePatterns.dueAt, now),
            eq(mistakePatterns.reviewPromptStatus, "succeeded")
          )
        );

      currentDueCount = dueCount ?? 0;

      if (currentDueCount === 0) {
        // No due items. Mark as skipped so we don't send anything.
        await db
          .update(emailDigestLogs)
          .set({
            status: "skipped",
            dueCount: 0,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(emailDigestLogs.userId, user.id),
              eq(emailDigestLogs.digestDate, digestDate)
            )
          );
        log.info(`[DigestWorker] No due items for user ${user.id}. Skipping.`);
        results.skipped++;
        continue;
      }

      // 3. Retrieve preview items and send email
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
            lte(mistakePatterns.dueAt, now),
            eq(mistakePatterns.reviewPromptStatus, "succeeded")
          )
        )
        .orderBy(asc(mistakePatterns.dueAt))
        .limit(5);

      await sendDigestEmail({
        to: user.email,
        userName: user.name,
        dueCount: currentDueCount,
        items: previewItems,
      });

      // 4. Mark as sent
      await db
        .update(emailDigestLogs)
        .set({
          status: "sent",
          dueCount: currentDueCount,
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(emailDigestLogs.userId, user.id),
            eq(emailDigestLogs.digestDate, digestDate)
          )
        );

      results.sent++;
      log.info(
        `[DigestWorker] Sent digest to ${user.email} with ${currentDueCount} due items`
      );
    } catch (err) {
      results.errors++;
      const message = err instanceof Error ? err.message : String(err);

      // Update status to failed so it can be retried later
      await db
        .update(emailDigestLogs)
        .set({
          status: "failed",
          dueCount: currentDueCount,
          errorMessage: message,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(emailDigestLogs.userId, user.id),
            eq(emailDigestLogs.digestDate, digestDate)
          )
        );

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

export const digestWorkerInternals = { currentVnDigestDate };
