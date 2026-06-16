import { Worker } from "bullmq";
import { redisConnection } from "../redis";
import { getLessonGenerationEngine } from "@/domain/lesson";
import { getLearnerMemoryEngine } from "@/domain/memory";
import { getLogger } from "@/lib/logger";
import { digestQueue, DIGEST_JOB_NAME } from "./digestQueue";
import { runDigestWorker } from "./digestWorker";
import { notifyJobQueued } from "./trigger";

const log = getLogger("c.c.worker.WorkerDaemon");

export async function runWorker(
  options: {
    workerId?: string;
    concurrency?: number;
    once?: boolean;
  } = {}
) {
  const workerId = options.workerId ?? `worker-${Date.now()}`;
  const concurrency =
    options.concurrency ?? Number(process.env.WORKER_CONCURRENCY ?? "1");
  const lessonEngine = getLessonGenerationEngine();
  const memoryEngine = getLearnerMemoryEngine();

  if (options.once) {
    log.info(
      `[WorkerDaemon] Once mode: Executing single tick for both engines.`
    );
    const lessonResult = await lessonEngine.processNext(workerId);
    const memoryResult =
      await memoryEngine.processNextReviewPromptJob(workerId);

    let processed = 0;
    if (lessonResult.status === "processed") processed++;
    if (memoryResult.status === "processed") processed++;
    return processed;
  }

  log.info(
    `Starting BullMQ Worker Daemon [${workerId}] with concurrency=${concurrency}...`
  );

  const lessonWorker = new Worker(
    "lesson-generation",
    async (job) => {
      log.info(
        `[LessonWorker] Processing job ${job.id} (${job.name}) from BullMQ`
      );
      const result = await lessonEngine.processNext(workerId);
      if (result.status === "idle") {
        log.info(`[LessonWorker] Idle: No lesson jobs found in PostgreSQL.`);
      } else {
        if (result.status === "failed" || !result.success) {
          log.warn(
            `[LessonWorker] Job finished with failed status in PostgreSQL.`
          );
        }
        // Self-draining queue: if we just processed a job, check if there are more
        notifyJobQueued().catch((err) => {
          log.error(`[LessonWorker] Failed to trigger follow-up job:`, err);
        });
      }
    },
    {
      connection: redisConnection,
      concurrency,
    }
  );

  const reviewWorker = new Worker(
    "review-prompt-generation",
    async (job) => {
      log.info(
        `[ReviewWorker] Processing job ${job.id} (${job.name}) from BullMQ`
      );
      const result = await memoryEngine.processNextReviewPromptJob(workerId);
      if (result.status === "idle") {
        log.info(
          `[ReviewWorker] Idle: No review prompt jobs found in PostgreSQL.`
        );
      } else {
        if (result.status === "failed" || !result.success) {
          log.warn(
            `[ReviewWorker] Job finished with failed status in PostgreSQL.`
          );
        }
        // Self-draining queue: if we just processed a job, check if there are more
        notifyJobQueued().catch((err) => {
          log.error(`[ReviewWorker] Failed to trigger follow-up job:`, err);
        });
      }
    },
    {
      connection: redisConnection,
      concurrency,
    }
  );

  lessonWorker.on("failed", (job, err) => {
    log.error(`[LessonWorker] Job ${job?.id} failed in BullMQ:`, err);
  });

  reviewWorker.on("failed", (job, err) => {
    log.error(`[ReviewWorker] Job ${job?.id} failed in BullMQ:`, err);
  });

  lessonWorker.on("error", (err) => {
    log.error("[LessonWorker] Global worker error:", err);
  });

  reviewWorker.on("error", (err) => {
    log.error("[ReviewWorker] Global worker error:", err);
  });

  const digestWorker = new Worker(
    "daily-digest",
    async (job) => {
      log.info(
        `[DigestWorker] Processing job ${job.id} (${job.name}) from BullMQ`
      );
      await runDigestWorker();
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  // Schedule the digest cron to run once per hour.
  // runDigestWorker() internally checks the current VN hour to match users.
  await digestQueue.add(
    DIGEST_JOB_NAME,
    {},
    {
      repeat: {
        pattern: "0 * * * *", // every hour at :00
      },
      jobId: `${DIGEST_JOB_NAME}-repeatable`,
    }
  );

  log.info(
    `Scheduled daily-digest cron (every hour). VN hour matching handled in worker.`
  );

  digestWorker.on("failed", (job, err) => {
    log.error(`[DigestWorker] Job ${job?.id} failed in BullMQ:`, err);
  });

  digestWorker.on("error", (err) => {
    log.error("[DigestWorker] Global worker error:", err);
  });

  log.info(`BullMQ Worker Daemon is active and listening to Redis.`);

  return {
    async close() {
      log.info("Stopping BullMQ workers...");
      await Promise.all([
        lessonWorker.close(),
        reviewWorker.close(),
        digestWorker.close(),
      ]);
      log.info("BullMQ workers stopped.");
    },
  };
}
