import { nanoid } from "nanoid";
import { getLessonGenerationEngine } from "@/domain/lesson";
import { getLearnerMemoryEngine } from "@/domain/memory";
import { getLogger } from "@/lib/logger";
import { sql } from "@/db";

const log = getLogger("c.c.worker.WorkerDaemon");

class Trigger {
  private resolve: (() => void) | null = null;

  async wait(ms: number) {
    let timeoutId: any;
    const timeoutPromise = new Promise<void>((res) => {
      timeoutId = setTimeout(res, ms);
    });
    const triggerPromise = new Promise<void>((res) => {
      this.resolve = res;
    });
    await Promise.race([timeoutPromise, triggerPromise]);
    clearTimeout(timeoutId);
    this.resolve = null;
  }

  fire() {
    if (this.resolve) {
      this.resolve();
    }
  }
}

export async function runWorker(options: {
  workerId?: string;
  concurrency?: number;
  once?: boolean;
} = {}) {
  const workerId = options.workerId ?? `worker-${nanoid(8)}`;
  const concurrency = options.concurrency ?? Number(process.env.WORKER_CONCURRENCY ?? "1");
  const lessonEngine = getLessonGenerationEngine();
  const memoryEngine = getLearnerMemoryEngine();
  const trigger = new Trigger();

  if (!options.once) {
    log.info(`Starting Worker Daemon [${workerId}] with concurrency=${concurrency}...`);
    try {
      await sql.listen("jobs_trigger", () => {
        log.info("Job notification received on channel 'jobs_trigger'. Triggering worker tick...");
        trigger.fire();
      });
    } catch (err) {
      log.error("Failed to start listening to channel 'jobs_trigger'", err);
    }
  }

  async function tick() {
    const lessonPromises = Array.from({ length: Math.max(1, concurrency) }, () => lessonEngine.processNext(workerId));
    const memoryPromises = Array.from({ length: Math.max(1, concurrency) }, () => memoryEngine.processNextReviewPromptJob(workerId));

    const results = await Promise.allSettled([...lessonPromises, ...memoryPromises]);

    let processedCount = 0;
    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.status === "processed") {
          processedCount += 1;
        }
      } else {
        log.error("Worker tick failure", result.reason);
      }
    }
    return processedCount;
  }

  if (options.once) {
    return tick();
  }

  let currentDelay = 2000;
  for (;;) {
    const processed = await tick();
    if (processed > 0) {
      currentDelay = 250;
    } else {
      currentDelay = Math.min(currentDelay * 1.5, 10000);
    }
    await trigger.wait(currentDelay);
  }
}
