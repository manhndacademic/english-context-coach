import React from "react";
import { Cpu } from "lucide-react";

interface ModelBreakdownTableProps {
  modelStats: Array<{
    model: string;
    requests: number;
    tokens: number;
    costMicros: number;
  }>;
}

export function ModelBreakdownTable({ modelStats }: ModelBreakdownTableProps) {
  return (
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
                  <td className="py-3 pr-4 font-mono text-xs text-text">
                    {item.model}
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {item.requests}
                  </td>
                  <td className="py-3 px-4 text-right text-muted">
                    {item.tokens.toLocaleString()}
                  </td>
                  <td className="py-3 pl-4 text-right font-semibold text-danger">
                    ${(item.costMicros / 1000000).toFixed(4)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-4 text-center text-muted">
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
