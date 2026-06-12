import { nanoid } from "nanoid";
import { getLessonGenerationEngine } from "@/domain/lesson";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runWorker(options: {
  workerId?: string;
  concurrency?: number;
  once?: boolean;
} = {}) {
  const workerId = options.workerId ?? `worker-${nanoid(8)}`;
  const concurrency = options.concurrency ?? Number(process.env.WORKER_CONCURRENCY ?? "1");
  const engine = getLessonGenerationEngine();

  async function tick() {
    const results = await Promise.allSettled(
      Array.from({ length: Math.max(1, concurrency) }, () => engine.processNext(workerId))
    );

    let processedCount = 0;
    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.status === "processed") {
          processedCount += 1;
        }
      } else {
        console.error(result.reason);
      }
    }
    return processedCount;
  }

  if (options.once) {
    return tick();
  }

  for (;;) {
    const processed = await tick();
    await delay(processed > 0 ? 250 : 2_000);
  }
}
