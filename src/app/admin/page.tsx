import { requireAdmin } from "@/lib/auth/guards";
import { db, schema } from "@/db";
import { sql, desc, and, eq, gt, inArray } from "drizzle-orm";
import { MetricsChart } from "@/components/admin/metrics-chart";
import { 
  Cpu, 
  Coins, 
  Percent, 
  Clock, 
  Activity,
  Layers,
  KeyRound,
  Users,
  UserCheck,
  ListTodo,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock3,
  Loader2,
  Server
} from "lucide-react";

export default async function AdminDashboardPage() {
  await requireAdmin();

  // eslint-disable-next-line react-hooks/purity
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // eslint-disable-next-line react-hooks/purity
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 1. Overall stats
  const [statsResult] = await db
    .select({
      totalCount: sql<number>`count(*)::int`,
      successCount: sql<number>`sum(case when status = 'succeeded' then 1 else 0 end)::int`,
      totalInputTokens: sql<number>`sum(coalesce(input_tokens, 0))::int`,
      totalOutputTokens: sql<number>`sum(coalesce(output_tokens, 0))::int`,
      totalCostMicros: sql<number>`sum(coalesce(cost_micros, 0))::int`,
      avgLatency: sql<number>`avg(case when status = 'succeeded' then latency_ms else null end)::int`,
    })
    .from(schema.aiRequests);

  const total = statsResult?.totalCount ?? 0;
  const success = statsResult?.successCount ?? 0;
  const fail = total - success;
  const successRate = total > 0 ? Math.round((success / total) * 100) : 100;
  const avgLatency = statsResult?.avgLatency ?? 0;
  const totalTokens = (statsResult?.totalInputTokens ?? 0) + (statsResult?.totalOutputTokens ?? 0);
  const totalCostUsd = parseFloat(((statsResult?.totalCostMicros ?? 0) / 1000000).toFixed(4));

  // 2. Daily metrics (last 30 days)
  const dailyStats = await db
    .select({
      date: sql<string>`to_char(created_at, 'YYYY-MM-DD')`,
      requests: sql<number>`count(*)::int`,
      cost: sql<number>`sum(coalesce(cost_micros, 0))::int`,
      tokens: sql<number>`sum(coalesce(input_tokens, 0) + coalesce(output_tokens, 0))::int`,
    })
    .from(schema.aiRequests)
    .groupBy(sql`to_char(created_at, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(created_at, 'YYYY-MM-DD') desc`)
    .limit(30);

  // 3. Model breakdown
  const modelStats = await db
    .select({
      model: schema.aiRequests.model,
      requests: sql<number>`count(*)::int`,
      tokens: sql<number>`sum(coalesce(input_tokens, 0) + coalesce(output_tokens, 0))::int`,
      costMicros: sql<number>`sum(coalesce(cost_micros, 0))::int`,
    })
    .from(schema.aiRequests)
    .groupBy(schema.aiRequests.model);

  // 4. Purpose breakdown
  const purposeStats = await db
    .select({
      purpose: schema.aiRequests.purpose,
      requests: sql<number>`count(*)::int`,
      tokens: sql<number>`sum(coalesce(input_tokens, 0) + coalesce(output_tokens, 0))::int`,
    })
    .from(schema.aiRequests)
    .groupBy(schema.aiRequests.purpose);

  // 5. System keys status count
  const [keysCountResult] = await db
    .select({
      active: sql<number>`sum(case when status = 'active' then 1 else 0 end)::int`,
      rateLimited: sql<number>`sum(case when status = 'rate_limited' then 1 else 0 end)::int`,
      invalid: sql<number>`sum(case when status = 'invalid' then 1 else 0 end)::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(schema.aiApiKeys);

  const activeKeys = keysCountResult?.active ?? 0;
  const rateLimitedKeys = keysCountResult?.rateLimited ?? 0;
  const invalidKeys = keysCountResult?.invalid ?? 0;
  const totalKeys = keysCountResult?.total ?? 0;

  // 5a. User Active (DAU / WAU)
  const [dauAi, dauAttempts, dauReviews] = await Promise.all([
    db
      .select({ userId: schema.aiRequests.userId })
      .from(schema.aiRequests)
      .where(
        and(
          gt(schema.aiRequests.createdAt, oneDayAgo),
          sql`${schema.aiRequests.userId} is not null`
        )
      ),
    db
      .select({ userId: schema.attempts.userId })
      .from(schema.attempts)
      .where(gt(schema.attempts.createdAt, oneDayAgo)),
    db
      .select({ userId: schema.reviewAttempts.userId })
      .from(schema.reviewAttempts)
      .where(gt(schema.reviewAttempts.createdAt, oneDayAgo)),
  ]);

  const dauUsersSet = new Set<string>();
  dauAi.forEach((r) => r.userId && dauUsersSet.add(r.userId));
  dauAttempts.forEach((r) => dauUsersSet.add(r.userId));
  dauReviews.forEach((r) => dauUsersSet.add(r.userId));
  const dau = dauUsersSet.size;

  const [wauAi, wauAttempts, wauReviews] = await Promise.all([
    db
      .select({ userId: schema.aiRequests.userId })
      .from(schema.aiRequests)
      .where(
        and(
          gt(schema.aiRequests.createdAt, sevenDaysAgo),
          sql`${schema.aiRequests.userId} is not null`
        )
      ),
    db
      .select({ userId: schema.attempts.userId })
      .from(schema.attempts)
      .where(gt(schema.attempts.createdAt, sevenDaysAgo)),
    db
      .select({ userId: schema.reviewAttempts.userId })
      .from(schema.reviewAttempts)
      .where(gt(schema.reviewAttempts.createdAt, sevenDaysAgo)),
  ]);

  const wauUsersSet = new Set<string>();
  wauAi.forEach((r) => r.userId && wauUsersSet.add(r.userId));
  wauAttempts.forEach((r) => wauUsersSet.add(r.userId));
  wauReviews.forEach((r) => wauUsersSet.add(r.userId));
  const wau = wauUsersSet.size;

  // 5b. AI Success Rate (24h)
  const [errorStats24h] = await db
    .select({
      total: sql<number>`count(*)::int`,
      failed: sql<number>`sum(case when status = 'failed' then 1 else 0 end)::int`,
    })
    .from(schema.aiRequests)
    .where(gt(schema.aiRequests.createdAt, oneDayAgo));

  const total24h = errorStats24h?.total ?? 0;
  const failed24h = errorStats24h?.failed ?? 0;
  const successRate24h = total24h > 0 ? Math.round(((total24h - failed24h) / total24h) * 100) : 100;

  // 5c. Top 10 Users by Resource Usage
  const topUsers = await db
    .select({
      userId: schema.aiRequests.userId,
      email: schema.users.email,
      customKeyConfigured: sql<boolean>`case when ${schema.users.customGeminiApiKey} is not null then true else false end`,
      totalRequests: sql<number>`count(*)::int`,
      totalTokens: sql<number>`sum(coalesce(${schema.aiRequests.inputTokens}, 0) + coalesce(${schema.aiRequests.outputTokens}, 0))::int`,
      totalCostUsd: sql<number>`sum(coalesce(${schema.aiRequests.costMicros}, 0))::double precision / 1000000`,
    })
    .from(schema.aiRequests)
    .leftJoin(schema.users, eq(schema.aiRequests.userId, schema.users.id))
    .groupBy(schema.aiRequests.userId, schema.users.email, schema.users.customGeminiApiKey)
    .orderBy(desc(sql`sum(coalesce(${schema.aiRequests.costMicros}, 0))`))
    .limit(10);

  // 5d. Background Job Queue status
  const jobStatsRaw = await db
    .select({
      status: schema.generationJobs.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.generationJobs)
    .groupBy(schema.generationJobs.status);

  const jobStats = {
    queued: jobStatsRaw.find(j => j.status === "queued")?.count ?? 0,
    running: jobStatsRaw.find(j => j.status === "running")?.count ?? 0,
    failed: jobStatsRaw.find(j => j.status === "failed")?.count ?? 0,
    succeeded: jobStatsRaw.find(j => j.status === "succeeded")?.count ?? 0,
  };

  const activeJobs = await db
    .select({
      id: schema.generationJobs.id,
      email: schema.users.email,
      status: schema.generationJobs.status,
      stage: schema.generationJobs.stage,
      attempts: schema.generationJobs.attempts,
      errorMessage: schema.generationJobs.errorMessage,
      createdAt: schema.generationJobs.createdAt,
    })
    .from(schema.generationJobs)
    .leftJoin(schema.users, eq(schema.generationJobs.userId, schema.users.id))
    .where(inArray(schema.generationJobs.status, ["queued", "running", "failed"]))
    .orderBy(desc(schema.generationJobs.createdAt))
    .limit(10);

  return (
    <>
      <div className="flex justify-between items-center border-b border-border pb-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-text m-0">Tổng quan số liệu AI</h1>
          <p className="text-muted text-sm m-0">Thống kê lưu lượng request, số lượng tokens sử dụng và chi phí ước tính.</p>
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-layout-gap">
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-[115px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Tổng Requests</span>
            <span className="text-accent bg-accent-light p-1.5 rounded-md shrink-0">
              <Activity size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block">{total}</strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">Thất bại: {fail}</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-[115px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Tỷ lệ thành công</span>
            <span className="text-warning bg-warning-light p-1.5 rounded-md shrink-0">
              <Percent size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block text-accent">{successRate}%</strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">Mục tiêu: &gt;95%</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-[115px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Tổng Tokens</span>
            <span className="text-success bg-success-light p-1.5 rounded-md shrink-0">
              <Cpu size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block">
              {totalTokens >= 1000000 ? `${(totalTokens / 1000000).toFixed(2)}M` : totalTokens.toLocaleString()}
            </strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">Input + Output tokens</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-[115px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Ước tính chi phí</span>
            <span className="text-danger bg-danger-light p-1.5 rounded-md shrink-0">
              <Coins size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block text-danger">${totalCostUsd}</strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">Chưa bao gồm miễn phí</span>
          </div>
        </div>
      </div>

      {/* Row 2: Active Users, Response Latency, Queue Stats, Keys Status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-layout-gap">
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-[115px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Người dùng active</span>
            <span className="text-accent bg-accent-light p-1.5 rounded-md shrink-0">
              <Users size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block">{dau} DAU</strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">7 ngày (WAU): {wau}</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-[115px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Phản hồi TB</span>
            <span className="text-warning bg-warning-light p-1.5 rounded-md shrink-0">
              <Clock size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block">
              {avgLatency > 0 ? `${(avgLatency / 1000).toFixed(2)}s` : "—"}
            </strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">Tỷ lệ 24h: {successRate24h}%</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-[115px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Hàng đợi dịch bài</span>
            <span className="text-success bg-success-light p-1.5 rounded-md shrink-0">
              <ListTodo size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block text-accent">
              {jobStats.running + jobStats.queued} Active
            </strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">Chờ: {jobStats.queued} · Lỗi: {jobStats.failed}</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-[115px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Hệ thống Keys</span>
            <span className="text-danger bg-danger-light p-1.5 rounded-md shrink-0">
              <KeyRound size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block">{totalKeys} Keys</strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">
              Active: <span className="text-success font-bold">{activeKeys}</span> · 
              Limited: <span className="text-warning font-bold">{rateLimitedKeys}</span> · 
              Bad: <span className="text-danger font-bold">{invalidKeys}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Visual Charts */}
      <MetricsChart data={dailyStats} />

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-layout-gap">
        {/* Model Breakdown */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 mt-0 flex items-center gap-2">
            <Cpu size={16} /> Phân bố theo Model
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-muted font-bold text-xs uppercase tracking-wider">
                  <th className="pb-2.5 pr-4">Model Name</th>
                  <th className="pb-2.5 px-4 text-right">Requests</th>
                  <th className="pb-2.5 px-4 text-right">Total Tokens</th>
                  <th className="pb-2.5 pl-4 text-right">Cost (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {modelStats.length ? (
                  modelStats.map((item) => (
                    <tr key={item.model} className="hover:bg-background/40">
                      <td className="py-3 pr-4 font-mono text-xs text-text">{item.model}</td>
                      <td className="py-3 px-4 text-right font-medium">{item.requests}</td>
                      <td className="py-3 px-4 text-right text-muted">{item.tokens.toLocaleString()}</td>
                      <td className="py-3 pl-4 text-right font-semibold text-danger">
                        ${(item.costMicros / 1000000).toFixed(4)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted">Chưa thực hiện request nào</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Purpose Breakdown */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 mt-0 flex items-center gap-2">
            <Layers size={16} /> Phân bố theo Mục đích
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-muted font-bold text-xs uppercase tracking-wider">
                  <th className="pb-2.5 pr-4">Mục đích (Purpose)</th>
                  <th className="pb-2.5 px-4 text-right">Requests</th>
                  <th className="pb-2.5 pl-4 text-right">Average Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {purposeStats.length ? (
                  purposeStats.map((item) => (
                    <tr key={item.purpose} className="hover:bg-background/40">
                      <td className="py-3 pr-4 font-semibold text-text capitalize">{item.purpose.replaceAll("_", " ")}</td>
                      <td className="py-3 px-4 text-right font-medium">{item.requests}</td>
                      <td className="py-3 pl-4 text-right text-muted">
                        {Math.round(item.tokens / item.requests).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-muted">Chưa thực hiện request nào</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 4: Top Users & Active Queue / Failed Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-layout-gap">
        {/* Top 10 Users by resource consumption */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 mt-0 flex items-center gap-2">
            <UserCheck size={16} /> Top 10 User sử dụng tài nguyên AI nhiều nhất
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-muted font-bold text-xs uppercase tracking-wider">
                  <th className="pb-2.5 pr-4">Email</th>
                  <th className="pb-2.5 px-4">Key cá nhân?</th>
                  <th className="pb-2.5 px-4 text-right">Requests</th>
                  <th className="pb-2.5 px-4 text-right">Tokens</th>
                  <th className="pb-2.5 pl-4 text-right">Chi phí (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topUsers.length ? (
                  topUsers.map((u, index) => (
                    <tr key={u.userId || index} className="hover:bg-background/40">
                      <td className="py-3 pr-4 truncate max-w-[150px] font-semibold text-text" title={u.email || "Guest"}>
                        {u.email || "Guest User"}
                      </td>
                      <td className="py-3 px-4">
                        {u.customKeyConfigured ? (
                          <span className="bg-success-light border border-success text-success text-[10px] px-2 py-0.5 rounded-full font-bold">
                            Yes
                          </span>
                        ) : (
                          <span className="bg-surface-strong border border-border text-muted text-[10px] px-2 py-0.5 rounded-full">
                            No
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">{u.totalRequests}</td>
                      <td className="py-3 px-4 text-right text-muted">{u.totalTokens.toLocaleString()}</td>
                      <td className="py-3 pl-4 text-right font-semibold text-danger">${u.totalCostUsd.toFixed(4)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-muted">Chưa có dữ liệu người dùng</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Background Job Queue & Failures list */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 mt-0 flex items-center gap-2">
            <Server size={16} /> Hàng đợi dịch & tác vụ lỗi
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-muted font-bold text-xs uppercase tracking-wider">
                  <th className="pb-2.5 pr-4">User Email</th>
                  <th className="pb-2.5 px-4">Trạng thái</th>
                  <th className="pb-2.5 px-4">Giai đoạn</th>
                  <th className="pb-2.5 px-4 text-center">Lần thử</th>
                  <th className="pb-2.5 pl-4">Chi tiết lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {activeJobs.length ? (
                  activeJobs.map((j) => (
                    <tr key={j.id} className="hover:bg-background/40">
                      <td className="py-2.5 pr-4 truncate max-w-[120px] font-semibold text-text" title={j.email || "Unknown"}>
                        {j.email || "Guest"}
                      </td>
                      <td className="py-2.5 px-4">
                        {j.status === "queued" && (
                          <span className="inline-flex items-center gap-1 bg-surface-strong border border-border text-muted px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <Clock3 size={10} /> Queued
                          </span>
                        )}
                        {j.status === "running" && (
                          <span className="inline-flex items-center gap-1 bg-accent-light border border-accent/15 text-accent px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <Loader2 size={10} className="animate-spin" /> Running
                          </span>
                        )}
                        {j.status === "failed" && (
                          <span className="inline-flex items-center gap-1 bg-danger-light border border-danger/15 text-danger px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <XCircle size={10} /> Failed
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[10px] uppercase text-muted">{j.stage}</td>
                      <td className="py-2.5 px-4 text-center font-medium">{j.attempts}</td>
                      <td className="py-2.5 pl-4 text-danger font-medium truncate max-w-[150px]" title={j.errorMessage || ""}>
                        {j.errorMessage || "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-muted">Hàng đợi đang trống (không có job chạy/lỗi)</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
