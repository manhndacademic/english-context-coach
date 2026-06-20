import { db } from "@/db";
import {
  generationJobs,
  lessons,
  generationMilestones,
  mistakePatterns,
  phrasePractices,
} from "@/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { notifyJobQueued } from "@/lib/jobs/trigger";
import { getLogger } from "@/lib/logger";

const log = getLogger("c.c.jobs.reclaim");

export async function runReclaimWorker(): Promise<{
  reclaimedLessons: number;
  reclaimedMistakePatterns: number;
}> {
  log.info("[ReclaimWorker] Starting stale job reclamation scan...");

  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

  let reclaimedLessons = 0;
  let reclaimedMistakePatterns = 0;
  let shouldWakeWorkers = false;

  // 1. Process stale generation_jobs
  try {
    const staleGenJobs = await db
      .select()
      .from(generationJobs)
      .where(
        and(
          eq(generationJobs.status, "running"),
          lte(generationJobs.lockedAt, staleThreshold)
        )
      );

    log.info(
      `[ReclaimWorker] Found ${staleGenJobs.length} stale generation jobs.`
    );

    for (const job of staleGenJobs) {
      reclaimedLessons++;
      const stage = job.stage as "analysis" | "exercises";
      const field = stage === "analysis" ? "analysisStatus" : "exerciseStatus";

      await db.transaction(async (tx) => {
        if (job.attempts < 3) {
          log.info(
            `[ReclaimWorker] Gen job ${job.id} (Lesson ${job.lessonId}) has attempts=${job.attempts} < 3. Re-queuing.`
          );

          // Reset job
          await tx
            .update(generationJobs)
            .set({
              status: "queued",
              lockedAt: null,
              lockedBy: null,
              updatedAt: new Date(),
            })
            .where(eq(generationJobs.id, job.id));

          // Set lesson status back to pending
          await tx
            .update(lessons)
            .set({
              [field]: "pending",
              updatedAt: new Date(),
            })
            .where(eq(lessons.id, job.lessonId));

          shouldWakeWorkers = true;
        } else {
          log.warn(
            `[ReclaimWorker] Gen job ${job.id} (Lesson ${job.lessonId}) has attempts=${job.attempts} >= 3. Marking failed.`
          );

          // Fail job
          await tx
            .update(generationJobs)
            .set({
              status: "failed",
              errorMessage:
                "Stale job reclaimed: exceeded maximum execution attempts.",
              lockedAt: null,
              lockedBy: null,
              updatedAt: new Date(),
            })
            .where(eq(generationJobs.id, job.id));

          // Fail lesson stage
          await tx
            .update(lessons)
            .set({
              [field]: "failed",
              updatedAt: new Date(),
            })
            .where(eq(lessons.id, job.lessonId));

          // Record failed milestone
          await tx.insert(generationMilestones).values({
            lessonId: job.lessonId,
            generationJobId: job.id,
            code: "failed",
            stage: stage,
            createdAt: new Date(),
          });
        }
      });
    }
  } catch (error) {
    log.error("[ReclaimWorker] Error reclaiming stale generation jobs:", error);
  }

  // 2. Process stale mistake_patterns (review prompt generation jobs)
  try {
    const staleMistakePatterns = await db
      .select()
      .from(mistakePatterns)
      .where(
        and(
          eq(mistakePatterns.reviewPromptStatus, "running"),
          lte(mistakePatterns.reviewPromptLockedAt, staleThreshold)
        )
      );

    log.info(
      `[ReclaimWorker] Found ${staleMistakePatterns.length} stale review prompt generation jobs.`
    );

    for (const pattern of staleMistakePatterns) {
      reclaimedMistakePatterns++;
      const attempts = pattern.reviewPromptAttempts ?? 0;

      await db.transaction(async (tx) => {
        if (attempts < 3) {
          log.info(
            `[ReclaimWorker] Mistake pattern ${pattern.id} review prompt job has attempts=${attempts} < 3. Re-queuing.`
          );

          await tx
            .update(mistakePatterns)
            .set({
              reviewPromptStatus: "queued",
              reviewPromptLockedAt: null,
              reviewPromptLockedBy: null,
              reviewPromptError: "Stale job reclaimed: re-queued.",
              updatedAt: new Date(),
            })
            .where(eq(mistakePatterns.id, pattern.id));

          shouldWakeWorkers = true;
        } else {
          log.warn(
            `[ReclaimWorker] Mistake pattern ${pattern.id} review prompt job has attempts=${attempts} >= 3. Marking failed.`
          );

          await tx
            .update(mistakePatterns)
            .set({
              reviewPromptStatus: "failed",
              reviewPromptLockedAt: null,
              reviewPromptLockedBy: null,
              reviewPromptError:
                "Stale job reclaimed: exceeded maximum execution attempts.",
              updatedAt: new Date(),
            })
            .where(eq(mistakePatterns.id, pattern.id));
        }
      });
    }
  } catch (error) {
    log.error(
      "[ReclaimWorker] Error reclaiming stale mistake patterns:",
      error
    );
  }

  // 3. Process stale phrase_practices (review prompt generation jobs)
  try {
    const stalePhrasePractices = await db
      .select()
      .from(phrasePractices)
      .where(
        and(
          eq(phrasePractices.reviewPromptStatus, "running"),
          lte(phrasePractices.reviewPromptLockedAt, staleThreshold)
        )
      );

    log.info(
      `[ReclaimWorker] Found ${stalePhrasePractices.length} stale phrase practice review prompt generation jobs.`
    );

    for (const practice of stalePhrasePractices) {
      const attempts = practice.reviewPromptAttempts ?? 0;

      await db.transaction(async (tx) => {
        if (attempts < 3) {
          log.info(
            `[ReclaimWorker] Phrase practice ${practice.id} review prompt job has attempts=${attempts} < 3. Re-queuing.`
          );

          await tx
            .update(phrasePractices)
            .set({
              reviewPromptStatus: "queued",
              reviewPromptLockedAt: null,
              reviewPromptLockedBy: null,
              reviewPromptError: "Stale job reclaimed: re-queued.",
              updatedAt: new Date(),
            })
            .where(eq(phrasePractices.id, practice.id));

          shouldWakeWorkers = true;
        } else {
          log.warn(
            `[ReclaimWorker] Phrase practice ${practice.id} review prompt job has attempts=${attempts} >= 3. Marking failed.`
          );

          await tx
            .update(phrasePractices)
            .set({
              reviewPromptStatus: "failed",
              reviewPromptLockedAt: null,
              reviewPromptLockedBy: null,
              reviewPromptError:
                "Stale job reclaimed: exceeded maximum execution attempts.",
              updatedAt: new Date(),
            })
            .where(eq(phrasePractices.id, practice.id));
        }
      });
    }
  } catch (error) {
    log.error(
      "[ReclaimWorker] Error reclaiming stale phrase practices:",
      error
    );
  }

  if (shouldWakeWorkers) {
    log.info("[ReclaimWorker] Waking up workers to process reclaimed jobs...");
    await notifyJobQueued().catch((err) => {
      log.error("[ReclaimWorker] Failed to wake workers:", err);
    });
  }

  log.info(
    `[ReclaimWorker] Finished scan. Reclaimed lessons: ${reclaimedLessons}, mistake patterns: ${reclaimedMistakePatterns}`
  );

  return { reclaimedLessons, reclaimedMistakePatterns };
}
