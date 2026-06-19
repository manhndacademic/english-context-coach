"use client";

import { useEffect, useState } from "react";
import { getUsageStatsAction } from "@/app/actions/settings";
import type { Timeframe } from "@/domain/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Activity,
  Cpu,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Copy,
  Check,
} from "lucide-react";

interface UsageDashboardProps {
  initialStats: any;
}

function formatLabelDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("vi-VN", {
      month: "numeric",
      day: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
}

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  today: "Hôm nay",
  "7days": "7 ngày qua",
  "30days": "30 ngày qua",
};

export function UsageDashboard({ initialStats }: UsageDashboardProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("7days");
  const [data, setData] = useState(initialStats);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyDiagnostics = (req: any) => {
    const text = `[ENGLISH CONTEXT COACH - DIAGNOSTICS LOG]
Yêu cầu ID: ${req.id}
Thời gian: ${new Date(req.createdAt).toISOString()}
Tác vụ: ${req.purpose}
Model: ${req.model}
Trạng thái: Thất bại (Failed)
Độ trễ: ${req.latencyMs ? `${(req.latencyMs / 1000).toFixed(2)}s` : "N/A"}
Thông điệp lỗi: ${req.errorMessage || "Không có thông điệp lỗi chi tiết."}`;

    navigator.clipboard.writeText(text);
    setCopiedId(req.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleTimeframeChange = async (newTimeframe: Timeframe) => {
    if (newTimeframe === timeframe) return;
    setLoading(true);
    setTimeframe(newTimeframe);
    try {
      const result = await getUsageStatsAction(newTimeframe);
      setData(result);
    } catch (error) {
      console.error("Failed to fetch usage stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const { summary, daily, recent } = data;

  const formattedChartData = daily.map((d: any) => ({
    ...d,
    label: formatLabelDate(d.date),
  }));

  const getPurposeLabel = (purpose: string) => {
    switch (purpose) {
      case "analysis":
        return "Phân tích ngữ cảnh";
      case "exercise_generation":
        return "Tạo bài tập";
      case "grading":
        return "Chấm điểm";
      case "repair":
        return "Sửa lỗi JSON";
      default:
        return purpose;
    }
  };

  if (!mounted) {
    return (
      <div className="h-96 w-full animate-pulse bg-surface border border-border rounded-lg" />
    );
  }

  return (
    <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="text-xl font-bold text-text flex items-center gap-2 m-0">
            <TrendingUp size={22} className="text-accent" /> Thống kê sử dụng AI
          </h2>
          <p className="text-muted text-sm m-0 mt-1">
            Theo dõi chi tiết số lượt gọi API, lượng token tiêu thụ và hiệu năng
            xử lý.
          </p>
        </div>

        {/* Timeframe selector */}
        <div className="flex border border-border rounded-md p-1 bg-background self-start sm:self-center shrink-0">
          {(["today", "7days", "30days"] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleTimeframeChange(t)}
              disabled={loading}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                timeframe === t
                  ? "bg-surface text-accent shadow-sm border border-border"
                  : "text-muted hover:text-text border border-transparent"
              } disabled:opacity-50`}
            >
              {TIMEFRAME_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Requests */}
        <div className="bg-background border border-border rounded-lg p-4 flex items-center gap-4 relative overflow-hidden">
          <div className="bg-accent-light text-accent-strong p-3 rounded-md">
            <Activity size={20} />
          </div>
          <div>
            <span className="text-muted text-xs font-semibold block uppercase">
              Tổng số request
            </span>
            <span className="text-2xl font-bold text-text block mt-1">
              {loading ? "..." : summary.totalRequests.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-background border border-border rounded-lg p-4 flex items-center gap-4">
          <div className="bg-success-light text-success-strong p-3 rounded-md">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="text-muted text-xs font-semibold block uppercase">
              Tỉ lệ thành công
            </span>
            <span className="text-2xl font-bold text-text block mt-1">
              {loading ? "..." : `${summary.successRate}%`}
            </span>
          </div>
        </div>

        {/* Total Tokens */}
        <div className="bg-background border border-border rounded-lg p-4 flex items-center gap-4">
          <div className="bg-warning-light text-warning-strong p-3 rounded-md">
            <Cpu size={20} />
          </div>
          <div>
            <span className="text-muted text-xs font-semibold block uppercase">
              Tokens tiêu thụ
            </span>
            <span className="text-2xl font-bold text-text block mt-1">
              {loading ? "..." : summary.totalTokens.toLocaleString()}
            </span>
            <span className="text-muted text-[10px] block mt-0.5">
              In: {summary.inputTokens.toLocaleString()} | Out:{" "}
              {summary.outputTokens.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Average Latency */}
        <div className="bg-background border border-border rounded-lg p-4 flex items-center gap-4">
          <div className="bg-info-light text-info-strong p-3 rounded-md">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-muted text-xs font-semibold block uppercase">
              Thời gian phản hồi
            </span>
            <span className="text-2xl font-bold text-text block mt-1">
              {loading ? "..." : `${summary.avgLatencySec}s`}
            </span>
            <span className="text-muted text-[10px] block mt-0.5">
              Trễ trung bình trên mỗi request
            </span>
          </div>
        </div>
      </div>

      {/* Daily Usage Chart */}
      <div className="bg-background border border-border rounded-lg p-4 sm:p-5">
        <h3 className="text-sm font-bold text-text uppercase tracking-wider mb-4 mt-0">
          Lượng token tiêu thụ theo ngày
        </h3>
        <div className="h-62.5 w-full">
          {formattedChartData.length > 0 &&
          daily.some((d: any) => d.inputTokens + d.outputTokens > 0) ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={formattedChartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
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
                  labelFormatter={(label) => `Ngày ${label}`}
                />
                <Legend
                  iconSize={10}
                  wrapperStyle={{ fontSize: "11px", marginTop: "10px" }}
                />
                <Bar
                  dataKey="inputTokens"
                  name="Tokens đầu vào (Prompt)"
                  stackId="a"
                  fill="#059669"
                  opacity={0.8}
                />
                <Bar
                  dataKey="outputTokens"
                  name="Tokens đầu ra (Completion)"
                  stackId="a"
                  fill="#d97706"
                  opacity={0.8}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <p className="text-sm font-semibold text-muted m-0">
                Chưa có dữ liệu token tiêu thụ trong khoảng thời gian này
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Request Log */}
      <div className="bg-background border border-border rounded-lg p-4 sm:p-5">
        <h3 className="text-sm font-bold text-text uppercase tracking-wider mb-4 mt-0">
          Lịch sử request gần đây
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-muted font-bold text-xs uppercase tracking-wider">
                <th className="pb-2.5 pr-4">Thời gian</th>
                <th className="pb-2.5 px-4">Tác vụ</th>
                <th className="pb-2.5 px-4">Model</th>
                <th className="pb-2.5 px-4">Trạng thái</th>
                <th className="pb-2.5 pl-4 text-right">Độ trễ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recent.length > 0 ? (
                recent.flatMap((req: any) => {
                  const isExpanded = expandedRowId === req.id;
                  const isCopied = copiedId === req.id;

                  return [
                    <tr key={req.id} className="hover:bg-surface/30">
                      <td className="py-3 pr-4 text-xs text-muted">
                        {new Date(req.createdAt).toLocaleDateString("vi-VN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-text text-xs">
                        {getPurposeLabel(req.purpose)}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted">
                        {req.model}
                      </td>
                      <td className="py-3 px-4">
                        {req.status === "succeeded" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success text-white dark:text-background border border-transparent px-2 py-0.5 text-[10px] font-bold">
                            <CheckCircle size={10} /> Thành công
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-danger text-white dark:text-background border border-transparent px-2 py-0.5 text-[10px] font-bold">
                              <AlertCircle size={10} /> Thất bại
                            </span>
                            <button
                              onClick={() =>
                                setExpandedRowId(isExpanded ? null : req.id)
                              }
                              className="text-[11px] text-accent-strong hover:underline font-semibold cursor-pointer select-none"
                            >
                              {isExpanded ? "Ẩn lỗi" : "Chi tiết lỗi"}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 pl-4 text-right font-medium text-xs text-text">
                        {req.latencyMs
                          ? `${(req.latencyMs / 1000).toFixed(2)}s`
                          : "—"}
                      </td>
                    </tr>,
                    isExpanded && (
                      <tr
                        key={`${req.id}-details`}
                        className="bg-danger-light/5"
                      >
                        <td colSpan={5} className="p-4 border-b border-border">
                          <div className="grid gap-3">
                            <div className="bg-surface border border-border p-3.5 rounded-md text-xs font-mono overflow-x-auto text-danger whitespace-pre-wrap max-h-40">
                              <strong className="block text-muted text-[10px] uppercase font-bold tracking-wider mb-1">
                                Thông báo lỗi từ hệ thống:
                              </strong>
                              {req.errorMessage ||
                                "Không tìm thấy thông điệp lỗi chi tiết từ máy chủ."}
                            </div>
                            <div className="flex gap-3 justify-end items-center">
                              <span className="text-muted text-[10px]">
                                Hãy chụp màn hình hoặc sao chép thông tin này
                                gửi cho kỹ thuật.
                              </span>
                              <button
                                onClick={() => handleCopyDiagnostics(req)}
                                className="inline-flex items-center justify-center gap-1.5 min-h-8 rounded-md border border-border px-3.5 font-bold text-xs bg-surface text-text hover:bg-background transition-all cursor-pointer shadow-sm"
                              >
                                {isCopied ? (
                                  <>
                                    <Check size={12} className="text-success" />{" "}
                                    Đã sao chép!
                                  </>
                                ) : (
                                  <>
                                    <Copy size={12} /> Sao chép chẩn đoán
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ),
                  ].filter(Boolean);
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-muted text-xs"
                  >
                    Chưa có lịch sử cuộc gọi API nào được ghi lại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
