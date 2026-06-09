import { runWorker } from "@/lib/jobs/worker";

runWorker().catch((error) => {
  console.error(error);
  process.exit(1);
});
