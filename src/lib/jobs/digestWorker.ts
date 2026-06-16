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

async function upsertDigestLog(input: {
  userId: string;
  digestDate: string;
  status: "sent" | "skipped" | "failed";
  dueCount: number;
  errorMessage?: string | null;
  sentAt?: Date | null;
}) {
  await db
    .insert(emailDigestLogs)
    .values({
      userId: input.userId,
      digestDate: input.digestDate,
      status: input.status,
      dueCount: input.dueCount,
      errorMessage: input.errorMessage ?? null,
      sentAt: input.sentAt ?? null,
    })
    .onConflictDoUpdate({
      target: [emailDigestLogs.userId, emailDigestLogs.digestDate],
      set: {
        status: input.status,
        dueCount: input.dueCount,
        errorMessage: input.errorMessage ?? null,
        sentAt: input.sentAt ?? null,
        updatedAt: new Date(),
      },
    });
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
    try {
      const [existingLog] = await db
        .select({ status: emailDigestLogs.status })
        .from(emailDigestLogs)
        .where(
          and(
            eq(emailDigestLogs.userId, user.id),
            eq(emailDigestLogs.digestDate, digestDate)
          )
        )
        .limit(1);
      if (existingLog?.status === "sent") {
        results.skipped++;
        log.info(
          `[DigestWorker] Digest already sent for user ${user.id} on ${digestDate}. Skipping.`
        );
        continue;
      }

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
        await upsertDigestLog({
          userId: user.id,
          digestDate,
          status: "skipped",
          dueCount: 0,
        });
        log.info(`[DigestWorker] No due items for user ${user.id}. Skipping.`);
        results.skipped++;
        continue;
      }

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
      await upsertDigestLog({
        userId: user.id,
        digestDate,
        status: "sent",
        dueCount,
        sentAt: new Date(),
      });

      results.sent++;
      log.info(
        `[DigestWorker] Sent digest to ${user.email} with ${dueCount} due items`
      );
    } catch (err) {
      results.errors++;
      const message = err instanceof Error ? err.message : String(err);
      await upsertDigestLog({
        userId: user.id,
        digestDate,
        status: "failed",
        dueCount: 0,
        errorMessage: message,
      });
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
