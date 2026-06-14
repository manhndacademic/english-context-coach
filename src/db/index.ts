import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/english_context_coach";

const globalForDb = globalThis as unknown as {
  sql?: postgres.Sql;
};

export const sql =
  globalForDb.sql ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "test" ? 1 : 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.sql = sql;
}

export const db = drizzle(sql, { schema });
export { schema };

export async function notifyJobQueued() {
  try {
    await sql`NOTIFY jobs_trigger`;

    // Dynamic import to prevent circular dependencies
    const { lessonQueue, reviewQueue } = await import("@/lib/jobs/queue");
    // We run them in fire-and-forget style or wait. Since it's helper, we handle errors gracefully.
    await lessonQueue.add("trigger-lesson", {}).catch((err) => {
      console.error("[PostgresNotify] BullMQ lesson enqueue error:", err);
    });
    await reviewQueue.add("trigger-review", {}).catch((err) => {
      console.error("[PostgresNotify] BullMQ review enqueue error:", err);
    });
  } catch (error) {
    console.error(
      "[PostgresNotify] Failed to send jobs_trigger NOTIFY:",
      error
    );
  }
}
