import { Worker } from "bullmq";
import { redisConnection } from "../redis";
import { getLessonGenerationEngine } from "@/domain/lesson";
import { getLearnerMemoryEngine } from "@/domain/memory";
import { getLogger } from "@/lib/logger";

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
      } else if (result.status === "processed" && !result.success) {
        log.warn(
          `[LessonWorker] Job finished with failed status in PostgreSQL.`
        );
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
      } else if (result.status === "processed" && !result.success) {
        log.warn(
          `[ReviewWorker] Job finished with failed status in PostgreSQL.`
        );
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

  log.info(`BullMQ Worker Daemon is active and listening to Redis.`);

  return {
    async close() {
      log.info("Stopping BullMQ workers...");
      await Promise.all([lessonWorker.close(), reviewWorker.close()]);
      log.info("BullMQ workers stopped.");
    },
  };
}
