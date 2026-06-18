import { UserCheck } from "lucide-react";

interface TopUsersTableProps {
  topUsers: Array<{
    userId: string | null;
    email: string | null;
    personalKeyCount: number;
    activePersonalKeyCount: number;
    totalRequests: number;
    totalTokens: number;
    totalCostUsd: number;
  }>;
}

export function TopUsersTable({ topUsers }: TopUsersTableProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 mt-0 flex items-center gap-2">
        <UserCheck size={16} /> Top 10 User sử dụng tài nguyên AI nhiều nhất
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border text-muted font-bold text-xs uppercase tracking-wider">
              <th className="pb-2.5 pr-4">Email</th>
              <th className="pb-2.5 px-4 whitespace-nowrap">Loại Key</th>
              <th className="pb-2.5 px-4 text-right">Requests</th>
              <th className="pb-2.5 px-4 text-right">Tokens</th>
              <th className="pb-2.5 pl-4 text-right">Chi phí (USD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {topUsers.length ? (
              topUsers.map((u, index) => (
                <tr key={u.userId || index} className="hover:bg-background/40">
                  <td
                    className="py-3 pr-4 truncate max-w-37.5 font-semibold text-text"
                    title={u.email || u.userId || "Anonymous"}
                  >
                    {u.email ||
                      (u.userId
                        ? `Guest (${u.userId.slice(0, 8)})`
                        : "System / Anon")}
                  </td>
                  <td className="py-3 px-4">
                    {u.personalKeyCount > 0 ? (
                      u.activePersonalKeyCount > 0 ? (
                        <span className="bg-success text-white dark:text-background border border-transparent text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                          Key cá nhân ({u.activePersonalKeyCount} active)
                        </span>
                      ) : (
                        <span className="bg-warning text-white dark:text-background border border-transparent text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                          Key cá nhân (0 active - Dùng key hệ thống)
                        </span>
                      )
                    ) : (
                      <span className="bg-surface-strong border border-border text-muted text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
                        Key hệ thống
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {u.totalRequests}
                  </td>
                  <td className="py-3 px-4 text-right text-muted">
                    {u.totalTokens.toLocaleString()}
                  </td>
                  <td className="py-3 pl-4 text-right font-semibold text-danger">
                    ${u.totalCostUsd.toFixed(4)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted">
                  Chưa có dữ liệu người dùng
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
