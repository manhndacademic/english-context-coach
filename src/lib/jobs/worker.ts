import { nanoid } from "nanoid";
import { getLessonGenerationEngine } from "@/domain/lesson";
import { getLearnerMemoryEngine } from "@/domain/memory";
import { getLogger } from "@/lib/logger";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = getLogger("c.c.worker.WorkerDaemon");

export async function runWorker(options: {
  workerId?: string;
  concurrency?: number;
  once?: boolean;
} = {}) {
  const workerId = options.workerId ?? `worker-${nanoid(8)}`;
  const concurrency = options.concurrency ?? Number(process.env.WORKER_CONCURRENCY ?? "1");
  const lessonEngine = getLessonGenerationEngine();
  const memoryEngine = getLearnerMemoryEngine();

  if (!options.once) {
    log.info(`Starting Worker Daemon [${workerId}] with concurrency=${concurrency}...`);
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
    await delay(currentDelay);
  }
}
