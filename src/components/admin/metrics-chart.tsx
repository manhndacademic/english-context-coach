"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DailyMetric {
  date: string;
  requests: number;
  cost: number;
  tokens: number;
}

interface MetricsChartProps {
  data: DailyMetric[];
}

function formatLabelDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("vi-VN", {
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
}

export function MetricsChart({ data }: MetricsChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] text-center bg-surface-strong/30 rounded-md border border-dashed border-border p-4">
        <p className="text-sm font-semibold text-muted m-0">
          Chưa có dữ liệu thống kê theo ngày
        </p>
      </div>
    );
  }

  // Format date labels for chart display
  const formattedData = [...data].reverse().map((d) => ({
    ...d,
    label: formatLabelDate(d.date),
    costUsd: parseFloat((d.cost / 1000000).toFixed(4)),
  }));

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-layout-gap">
        <div className="bg-surface border border-border rounded-lg p-5 shadow-sm min-w-0 h-70 animate-pulse" />
        <div className="bg-surface border border-border rounded-lg p-5 shadow-sm min-w-0 h-70 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-layout-gap">
      <div className="bg-surface border border-border rounded-lg p-5 shadow-sm min-w-0">
        <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 mt-0">
          Tần suất request (30 ngày gần đây)
        </h3>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={formattedData}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="requestsGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: any) => [`${value} requests`, "Số lượng"]}
              />
              <Area
                type="monotone"
                dataKey="requests"
                stroke="#059669"
                strokeWidth={2}
                fill="url(#requestsGradient)"
                dot={{ fill: "#059669", r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5 shadow-sm min-w-0">
        <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 mt-0">
          Chi phí tích lũy (30 ngày gần đây)
        </h3>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={formattedData}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: any) => [`$${value}`, "Chi phí (USD)"]}
              />
              <Area
                type="monotone"
                dataKey="costUsd"
                stroke="#d97706"
                strokeWidth={2}
                fill="url(#costGradient)"
                dot={{ fill: "#d97706", r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
