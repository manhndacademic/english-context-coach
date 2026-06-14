import { DrizzleAdminMetricsRepository } from "./adapters/drizzle-admin-metrics";
import type { AdminMetricsRepository } from "./ports";

let cachedRepo: AdminMetricsRepository | null = null;

export function getAdminMetricsRepository(): AdminMetricsRepository {
  if (!cachedRepo) {
    cachedRepo = new DrizzleAdminMetricsRepository();
  }
  return cachedRepo;
}

export type { AdminMetricsRepository } from "./ports";
