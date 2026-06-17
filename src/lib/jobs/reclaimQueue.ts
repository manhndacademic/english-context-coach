import { Queue } from "bullmq";
import { redisConnection } from "../redis";

export const reclaimQueue = new Queue("stale-job-reclamation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const RECLAIM_JOB_NAME = "reclaim-stale-jobs";
