"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TrendingDown } from "lucide-react";

interface WeeklyTrend {
  week: string;
  literalRatio: number;
  total: number;
}

interface LiteralErrorTrendChartProps {
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

export function LiteralErrorTrendChart({ data }: LiteralErrorTrendChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-45 bg-surface-strong/10 animate-pulse rounded-md" />
    );
  }

  if (data.length === 0) {
    const mockData = [
      { label: "T1", literalRatio: 50 },
      { label: "T2", literalRatio: 40 },
      { label: "T3", literalRatio: 30 },
      { label: "T4", literalRatio: 20 },
    ];
    return (
      <div className="relative w-full h-45">
        {/* Visual blur overlay containing the educational message */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 text-center bg-background/20 backdrop-blur-[1.5px] p-4">
          <div className="bg-surface/90 border border-border p-2 rounded-full shadow-sm text-accent shrink-0">
            <TrendingDown size={20} className="animate-pulse" />
          </div>
          <p className="text-sm font-bold text-text m-0">
            Dữ liệu sẽ hiển thị khi bạn bắt đầu luyện tập!
          </p>
          <p className="text-xs text-muted m-0 max-w-[320px] leading-relaxed">
            Biểu đồ xu hướng bẫy dịch literal sẽ theo dõi tỷ lệ lỗi dịch từng từ
            của bạn theo từng tuần.
          </p>
        </div>

        {/* Muted skeleton preview chart to tease functionality */}
        <div className="w-full h-full opacity-25 pointer-events-none select-none">
          <ResponsiveContainer width="100%" height={180} minWidth={0}>
            <LineChart
              data={mockData}
              margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--muted, #6b7280)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted, #6b7280)" }}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              <Line
                type="monotone"
                dataKey="literalRatio"
                stroke="var(--muted, #6b7280)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
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
    <ResponsiveContainer width="100%" height={180} minWidth={0}>
      <LineChart
        data={formatted}
        margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
      >
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
          unit="%"
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface, #fff)",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: "8px",
            fontSize: "12px",
            padding: "8px 12px",
          }}
          formatter={(value: any, _name: any, props: any) => {
            const totalVal = props.payload.total;
            return [
              `${value}% (${Math.round((value / 100) * totalVal)}/${totalVal} lỗi)`,
              "Tỷ lệ dịch literal",
            ];
          }}
          labelFormatter={(label) => `Tuần ${label}`}
        />
        <Line
          type="monotone"
          dataKey="literalRatio"
          stroke="#ea580c"
          strokeWidth={2.5}
          dot={{ fill: "#ea580c", strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, fill: "#ea580c" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
