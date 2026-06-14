import { Queue } from "bullmq";
import { redisConnection } from "../redis";

export const lessonQueue = new Queue("lesson-generation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true, // Keep Redis clean
    removeOnFail: false, // Keep failed jobs for debugging
  },
});

export const reviewQueue = new Queue("review-prompt-generation", {
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
