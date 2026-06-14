import React from "react";
import { Server, Clock3, Loader2, XCircle } from "lucide-react";

interface GenerationJobsTableProps {
  activeJobs: Array<{
    id: string;
    userId: string | null;
    email: string | null;
    status: string;
    stage: string;
    attempts: number;
    errorMessage: string | null;
    createdAt: Date;
  }>;
}

export function GenerationJobsTable({ activeJobs }: GenerationJobsTableProps) {
  return (
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
                  <td
                    className="py-2.5 pr-4 truncate max-w-30 font-semibold text-text"
                    title={j.email || j.userId || "Unknown"}
                  >
                    {j.email ||
                      (j.userId
                        ? `Guest (${j.userId.slice(0, 8)})`
                        : "System / Anon")}
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
                  <td className="py-2.5 px-4 font-mono text-[10px] uppercase text-muted">
                    {j.stage}
                  </td>
                  <td className="py-2.5 px-4 text-center font-medium">
                    {j.attempts}
                  </td>
                  <td
                    className="py-2.5 pl-4 text-danger font-medium truncate max-w-37.5"
                    title={j.errorMessage || ""}
                  >
                    {j.errorMessage || "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted">
                  Hàng đợi đang trống (không có job chạy/lỗi)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
