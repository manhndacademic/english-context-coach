import { Queue } from "bullmq";
import { redisConnection } from "../redis";

/**
 * BullMQ queue for daily review digest emails.
 *
 * Repeatable jobs are scheduled by the worker daemon at startup.
 * Each tick dispatches email sending to all opted-in users who have
 * due review items.
 */
export const digestQueue = new Queue("daily-digest", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 30_000, // 30s — email sending is not time-critical
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

/** Job name used to identify the repeatable digest job */
export const DIGEST_JOB_NAME = "send-digest";
