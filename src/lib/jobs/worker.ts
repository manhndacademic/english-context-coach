import { nanoid } from "nanoid";
import type { schema } from "@/db";
import { claimGenerationJob, processGenerationJob } from "./generation";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runWorker(options: {
  workerId?: string;
  concurrency?: number;
  once?: boolean;
} = {}) {
  const workerId = options.workerId ?? `worker-${nanoid(8)}`;
  const concurrency = options.concurrency ?? Number(process.env.WORKER_CONCURRENCY ?? "1");

  async function tick() {
    const jobs = await Promise.all(
      Array.from({ length: Math.max(1, concurrency) }, () => claimGenerationJob(workerId)),
    );

    const claimed = jobs.filter(
      (job): job is typeof schema.generationJobs.$inferSelect => Boolean(job),
    );
    const results = await Promise.allSettled(claimed.map((job) => processGenerationJob(job)));
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(result.reason);
      }
    }
    return claimed.length;
  }

  if (options.once) {
    return tick();
  }

  for (;;) {
    const processed = await tick();
    await delay(processed > 0 ? 250 : 2_000);
  }
}
