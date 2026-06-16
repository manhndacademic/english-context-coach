import {
  Activity,
  Percent,
  Cpu,
  Coins,
  Users,
  Clock,
  ListTodo,
  KeyRound,
  MailCheck,
} from "lucide-react";

interface MetricsOverviewProps {
  total: number;
  fail: number;
  successRate: number;
  totalTokens: number;
  totalCostUsd: number;
  dau: number;
  wau: number;
  avgLatency: number;
  successRate24h: number;
  jobStats: {
    running: number;
    queued: number;
    failed: number;
  };
  keysCount: {
    total: number;
    active: number;
    rateLimited: number;
    invalid: number;
  };
  digestStats: {
    sent: number;
    skipped: number;
    failed: number;
    enabledUsers: number;
  };
}

export function MetricsOverview({
  total,
  fail,
  successRate,
  totalTokens,
  totalCostUsd,
  dau,
  wau,
  avgLatency,
  successRate24h,
  jobStats,
  keysCount,
  digestStats,
}: MetricsOverviewProps) {
  return (
    <>
      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-layout-gap">
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-28.75">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">
              Tổng Requests
            </span>
            <span className="text-accent bg-accent-light p-1.5 rounded-md shrink-0">
              <Activity size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block">
              {total}
            </strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">
              Thất bại: {fail}
            </span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-28.75">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">
              Tỷ lệ thành công
            </span>
            <span className="text-warning bg-warning-light p-1.5 rounded-md shrink-0">
              <Percent size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block text-accent">
              {successRate}%
            </strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">
              Mục tiêu: &gt;95%
            </span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-28.75">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">
              Tổng Tokens
            </span>
            <span className="text-success bg-success-light p-1.5 rounded-md shrink-0">
              <Cpu size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block">
              {totalTokens >= 1000000
                ? `${(totalTokens / 1000000).toFixed(2)}M`
                : totalTokens.toLocaleString()}
            </strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">
              Input + Output tokens
            </span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-28.75">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">
              Ước tính chi phí
            </span>
            <span className="text-danger bg-danger-light p-1.5 rounded-md shrink-0">
              <Coins size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block text-danger">
              ${totalCostUsd}
            </strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">
              Chưa bao gồm miễn phí
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Active Users, Latency, Queue Stats, Keys Status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-layout-gap">
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-28.75">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">
              Người dùng active
            </span>
            <span className="text-accent bg-accent-light p-1.5 rounded-md shrink-0">
              <Users size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block">
              {dau} DAU
            </strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">
              7 ngày (WAU): {wau}
            </span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-28.75">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">
              Phản hồi TB
            </span>
            <span className="text-warning bg-warning-light p-1.5 rounded-md shrink-0">
              <Clock size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block">
              {avgLatency > 0 ? `${(avgLatency / 1000).toFixed(2)}s` : "—"}
            </strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">
              Tỷ lệ 24h: {successRate24h}%
            </span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-28.75">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">
              Hàng đợi dịch bài
            </span>
            <span className="text-success bg-success-light p-1.5 rounded-md shrink-0">
              <ListTodo size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block text-accent">
              {jobStats.running + jobStats.queued} Active
            </strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">
              Chờ: {jobStats.queued} · Lỗi: {jobStats.failed}
            </span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-28.75">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">
              Hệ thống Keys
            </span>
            <span className="text-danger bg-danger-light p-1.5 rounded-md shrink-0">
              <KeyRound size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block">
              {keysCount.total} Keys
            </strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">
              Active:{" "}
              <span className="text-success font-bold">{keysCount.active}</span>{" "}
              · Limited:{" "}
              <span className="text-warning font-bold">
                {keysCount.rateLimited}
              </span>{" "}
              · Bad:{" "}
              <span className="text-danger font-bold">{keysCount.invalid}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-layout-gap">
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between h-28.75 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">
              Email digest hôm nay
            </span>
            <span className="text-accent bg-accent-light p-1.5 rounded-md shrink-0">
              <MailCheck size={16} />
            </span>
          </div>
          <div className="mt-2">
            <strong className="text-2xl font-bold leading-none tracking-tight block">
              {digestStats.sent} Sent
            </strong>
            <span className="text-[10px] text-muted block mt-1.5 truncate">
              Skipped: {digestStats.skipped} · Failed: {digestStats.failed} ·
              Enabled users: {digestStats.enabledUsers}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
