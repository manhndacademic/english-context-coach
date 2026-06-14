// Pure data transformation utilities for admin metrics
// These functions have no side effects and can be tested without a database

export function computeSuccessRate(total: number, success: number): number {
  return total > 0 ? Math.round((success / total) * 100) : 100;
}

export function microsToUsd(micros: number): number {
  return parseFloat((micros / 1_000_000).toFixed(4));
}

export function normalizeJobStats(
  jobStatsRaw: Array<{ status: string; count: number }>
): { queued: number; running: number; failed: number; succeeded: number } {
  return {
    queued: jobStatsRaw.find((j) => j.status === "queued")?.count ?? 0,
    running: jobStatsRaw.find((j) => j.status === "running")?.count ?? 0,
    failed: jobStatsRaw.find((j) => j.status === "failed")?.count ?? 0,
    succeeded: jobStatsRaw.find((j) => j.status === "succeeded")?.count ?? 0,
  };
}

export function computeActiveUserCount(
  ...resultSets: Array<Array<{ userId: string | null }>>
): number {
  const uniqueIds = new Set<string>();
  for (const rows of resultSets) {
    for (const row of rows) {
      if (row.userId) uniqueIds.add(row.userId);
    }
  }
  return uniqueIds.size;
}
