import { requireAdmin } from "@/lib/auth/guards";
import { getAdminMetricsRepository } from "@/domain/admin";
import {
  computeSuccessRate,
  microsToUsd,
  normalizeJobStats,
} from "@/lib/admin-metrics";
import { MetricsOverview } from "@/components/admin/MetricsOverview";
import { ModelBreakdownTable } from "@/components/admin/ModelBreakdownTable";
import { PurposeBreakdownTable } from "@/components/admin/PurposeBreakdownTable";
import { TopUsersTable } from "@/components/admin/TopUsersTable";
import { GenerationJobsTable } from "@/components/admin/GenerationJobsTable";
import dynamic from "next/dynamic";

const MetricsChart = dynamic(
  () =>
    import("@/components/admin/metrics-chart").then((mod) => mod.MetricsChart),
  {
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-layout-gap">
        <div className="bg-surface border border-border rounded-lg p-5 shadow-sm min-w-0 h-70 animate-pulse" />
        <div className="bg-surface border border-border rounded-lg p-5 shadow-sm min-w-0 h-70 animate-pulse" />
      </div>
    ),
  }
);

function currentVnDigestDate(now = new Date()): string {
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().slice(0, 10);
}

export default async function AdminDashboardPage() {
  await requireAdmin();

  // eslint-disable-next-line react-hooks/purity
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // eslint-disable-next-line react-hooks/purity
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const adminRepo = getAdminMetricsRepository();

  // 1. Overall stats
  const statsResult = await adminRepo.getOverallAiStats();

  const total = statsResult.totalCount;
  const success = statsResult.successCount;
  const fail = total - success;
  const successRate = computeSuccessRate(total, success);
  const avgLatency = statsResult.avgLatency;
  const totalTokens =
    statsResult.totalInputTokens + statsResult.totalOutputTokens;
  const totalCostUsd = microsToUsd(statsResult.totalCostMicros);

  // Fetch all independent metrics in parallel
  const [
    dailyStats,
    modelStats,
    purposeStats,
    keysCountResult,
    dau,
    wau,
    errorStats24h,
    digestStats,
    topUsers,
    jobStatsRaw,
    activeJobs,
  ] = await Promise.all([
    adminRepo.getDailyAiMetrics(30),
    adminRepo.getAiStatsByModel(),
    adminRepo.getAiStatsByPurpose(),
    adminRepo.getApiKeysStatusCounts(),
    adminRepo.getActiveUserCount(oneDayAgo),
    adminRepo.getActiveUserCount(sevenDaysAgo),
    adminRepo.getAiErrorStats24h(oneDayAgo),
    adminRepo.getDigestStatsByDate(currentVnDigestDate()),
    adminRepo.getTopUsersByResourceUsage(10),
    adminRepo.getJobStatusBreakdown(),
    adminRepo.getActiveAndFailedJobs(10),
  ]);

  const activeKeys = keysCountResult.active;
  const rateLimitedKeys = keysCountResult.rateLimited;
  const invalidKeys = keysCountResult.invalid;
  const totalKeys = keysCountResult.total;

  const total24h = errorStats24h.total;
  const failed24h = errorStats24h.failed;
  const successRate24h = computeSuccessRate(total24h, total24h - failed24h);

  const jobStats = normalizeJobStats(jobStatsRaw);

  return (
    <>
      <div className="flex justify-between items-center border-b border-border pb-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-text m-0">
            Tổng quan số liệu AI
          </h1>
          <p className="text-muted text-sm m-0">
            Thống kê lưu lượng request, số lượng tokens sử dụng và chi phí ước
            tính.
          </p>
        </div>
      </div>

      <MetricsOverview
        total={total}
        fail={fail}
        successRate={successRate}
        totalTokens={totalTokens}
        totalCostUsd={totalCostUsd}
        dau={dau}
        wau={wau}
        avgLatency={avgLatency}
        successRate24h={successRate24h}
        jobStats={jobStats}
        keysCount={{
          total: totalKeys,
          active: activeKeys,
          rateLimited: rateLimitedKeys,
          invalid: invalidKeys,
        }}
        digestStats={digestStats}
      />

      {/* Visual Charts */}
      <MetricsChart data={dailyStats} />

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-layout-gap">
        <ModelBreakdownTable modelStats={modelStats} />
        <PurposeBreakdownTable purposeStats={purposeStats} />
      </div>

      {/* Row 4: Top Users & Active Queue / Failed Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-layout-gap">
        <TopUsersTable topUsers={topUsers} />
        <GenerationJobsTable activeJobs={activeJobs} />
      </div>
    </>
  );
}
