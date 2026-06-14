import { sql } from "@/db";

/**
 * Consolidates background job notification mechanisms.
 * Triggers a Postgres NOTIFY event and enqueues tasks in BullMQ
 * to process lesson generation and review prompt generation.
 */
export async function notifyJobQueued() {
  try {
    // 1. Notify PostgreSQL to trigger any listeners (e.g. pg_events)
    await sql`NOTIFY jobs_trigger`.catch((err) => {
      console.error("[JobTrigger] PostgreSQL NOTIFY error:", err);
    });

    // 2. Dynamic import to prevent circular dependencies
    const { lessonQueue, reviewQueue } = await import("@/lib/jobs/queue");

    // 3. Queue jobs on BullMQ to wake up workers
    await lessonQueue.add("process-next-lesson", {}).catch((err) => {
      console.error("[JobTrigger] BullMQ lesson enqueue error:", err);
    });
    await reviewQueue.add("process-next-review-prompt", {}).catch((err) => {
      console.error("[JobTrigger] BullMQ review enqueue error:", err);
    });
  } catch (error) {
    console.error("[JobTrigger] Failed to trigger background jobs:", error);
  }
}
