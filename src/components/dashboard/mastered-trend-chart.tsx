"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface WeeklyTrend {
  week: string;
  cumulative: number;
}

interface MasteredTrendChartProps {
  data: WeeklyTrend[];
}

function formatWeek(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  return d.toLocaleDateString("vi-VN", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function MasteredTrendChart({ data }: MasteredTrendChartProps) {
  if (data.length === 0) {
    const mockData = [
      { label: "T1", cumulative: 0 },
      { label: "T2", cumulative: 2 },
      { label: "T3", cumulative: 3 },
      { label: "T4", cumulative: 6 },
    ];
    return (
      <div className="relative w-full h-[180px]">
        {/* Visual blur overlay containing the educational message */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 text-center bg-background/20 backdrop-blur-[1.5px] p-4">
          <div className="bg-surface/90 border border-border p-2 rounded-full shadow-sm text-accent shrink-0">
            <TrendingUp size={20} className="animate-pulse" />
          </div>
          <p className="text-sm font-bold text-text m-0">Hãy tiếp tục ôn tập để thấy tiến bộ!</p>
          <p className="text-xs text-muted m-0 max-w-[320px] leading-relaxed">
            Biểu đồ xu hướng thành thạo sẽ tự động hiển thị sau khi bạn giải quyết mẫu lỗi đầu tiên.
          </p>
        </div>

        {/* Muted skeleton preview chart to tease functionality */}
        <div className="w-full h-full opacity-25 pointer-events-none select-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="skeletonGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--muted, #6b7280)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--muted, #6b7280)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted, #6b7280)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted, #6b7280)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="var(--muted, #6b7280)"
                strokeWidth={2}
                fill="url(#skeletonGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: formatWeek(d.week),
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={formatted} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="masteredGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#059669" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--muted, #6b7280)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted, #6b7280)" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface, #fff)",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: "8px",
            fontSize: "12px",
            padding: "8px 12px",
          }}
          formatter={(value: any) => [`${value} mẫu lỗi`, "Đã thành thạo"]}
          labelFormatter={(label) => `Tuần ${label}`}
        />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke="#059669"
          strokeWidth={2.5}
          fill="url(#masteredGradient)"
          dot={{ fill: "#059669", strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, fill: "#059669" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
