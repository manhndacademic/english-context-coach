import { sql } from "@/db";

/**
 * Consolidates background job notification mechanisms.
 * Triggers a Postgres NOTIFY event and enqueues tasks in BullMQ
 * to process lesson generation and review prompt generation.
 */
export async function notifyJobQueued() {
  try {
    // 1. Notify PostgreSQL to trigger any listeners and dynamically import BullMQ queues in parallel
    const [_, queues] = await Promise.all([
      sql`NOTIFY jobs_trigger`.catch((err) => {
        console.error("[JobTrigger] PostgreSQL NOTIFY error:", err);
      }),
      import("@/lib/jobs/queue"),
    ]);

    const { lessonQueue, reviewQueue } = queues;

    // 2. Queue both jobs on BullMQ concurrently
    await Promise.all([
      lessonQueue.add("process-next-lesson", {}).catch((err) => {
        console.error("[JobTrigger] BullMQ lesson enqueue error:", err);
      }),
      reviewQueue.add("process-next-review-prompt", {}).catch((err) => {
        console.error("[JobTrigger] BullMQ review enqueue error:", err);
      }),
    ]);
  } catch (error) {
    console.error("[JobTrigger] Failed to trigger background jobs:", error);
  }
}
