import React from "react";
import { Layers } from "lucide-react";

interface PurposeBreakdownTableProps {
  purposeStats: Array<{
    purpose: string;
    requests: number;
    tokens: number;
  }>;
}

export function PurposeBreakdownTable({
  purposeStats,
}: PurposeBreakdownTableProps) {
  return (
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
                  <td className="py-3 pr-4 font-semibold text-text capitalize">
                    {item.purpose.replaceAll("_", " ")}
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {item.requests}
                  </td>
                  <td className="py-3 pl-4 text-right text-muted">
                    {Math.round(item.tokens / item.requests).toLocaleString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="py-4 text-center text-muted">
                  Chưa thực hiện request nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
