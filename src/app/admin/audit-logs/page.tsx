import { requireAdmin } from "@/lib/auth/guards";
import { getAdminAuditLogs } from "@/domain/admin/audit";
import { FileText, Search } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  approve_user: "Phê duyệt người dùng",
  reject_user: "Từ chối người dùng",
  revoke_user: "Hủy phê duyệt người dùng",
  add_system_api_key: "Thêm API Key hệ thống",
  delete_system_api_key: "Xóa API Key hệ thống",
  reverify_system_api_key: "Xác thực lại API Key hệ thống",
  toggle_admin: "Thay đổi quyền admin",
};

const ADMIN_ACTIONS = [
  { value: "all", label: "Tất cả hành động" },
  { value: "approve_user", label: "Phê duyệt người dùng" },
  { value: "reject_user", label: "Từ chối người dùng" },
  { value: "revoke_user", label: "Hủy phê duyệt" },
  { value: "add_system_api_key", label: "Thêm API Key hệ thống" },
  { value: "delete_system_api_key", label: "Xóa API Key hệ thống" },
  { value: "reverify_system_api_key", label: "Xác thực lại API Key" },
];

interface AuditLogsPageProps {
  searchParams: Promise<{
    action?: string;
  }>;
}

export default async function AdminAuditLogsPage({
  searchParams,
}: AuditLogsPageProps) {
  await requireAdmin();
  const { action } = await searchParams;
  const activeAction = action && action !== "all" ? action : undefined;

  const logs = await getAdminAuditLogs({
    action: activeAction,
    limit: 100,
  });

  return (
    <>
      <div className="flex justify-between items-center border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-text m-0">
            Nhật ký hoạt động Admin
          </h1>
          <p className="text-muted text-sm m-0">
            Xem lịch sử các hành động quản trị hệ thống và cấu hình API Keys.
          </p>
        </div>
      </div>

      {/* Filter Form */}
      <section className="bg-surface border border-border rounded-lg p-4 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-text">
          <Search size={16} className="text-muted" /> Bộ lọc hành động
        </div>
        <form method="GET" className="flex gap-2">
          <select
            name="action"
            defaultValue={action || "all"}
            className="bg-background text-text border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-primary-light"
          >
            {ADMIN_ACTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-primary hover:bg-primary-hover text-white text-xs font-bold px-4 py-1.5 rounded-md transition-colors"
          >
            Lọc
          </button>
        </form>
      </section>

      {/* Audit Logs Table */}
      <section className="bg-surface border border-border rounded-lg p-5 sm:p-6 shadow-sm">
        <h2 className="text-lg font-bold text-text flex items-center gap-2 mb-4 mt-0">
          <FileText size={18} className="text-muted" /> Lịch sử hoạt động gần
          đây
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-muted font-bold text-xs uppercase tracking-wider">
                <th className="pb-2.5 pr-4">Thời gian</th>
                <th className="pb-2.5 px-4">Admin</th>
                <th className="pb-2.5 px-4">Hành động</th>
                <th className="pb-2.5 px-4">Đối tượng</th>
                <th className="pb-2.5 pl-4 text-right">Chi tiết (Metadata)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length ? (
                logs.map((log) => {
                  const actionLabel = ACTION_LABELS[log.action] || log.action;
                  const targetLabel = log.targetEmail
                    ? `${log.targetResourceType}: ${log.targetEmail}`
                    : log.targetResourceId
                      ? `${log.targetResourceType} (${log.targetResourceId.slice(0, 8)})`
                      : "N/A";

                  return (
                    <tr key={log.id} className="hover:bg-background/40">
                      <td className="py-3 pr-4 text-muted text-xs whitespace-nowrap">
                        {log.createdAt.toLocaleString("vi-VN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-text">
                        <div>{log.adminName || "System"}</div>
                        <div className="text-xs text-muted font-normal">
                          {log.adminEmail}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center rounded bg-surface-strong px-2.5 py-0.5 text-xs font-semibold text-text border border-border">
                          {actionLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-text">
                        {targetLabel}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        {log.metadata &&
                        Object.keys(log.metadata).length > 0 ? (
                          <pre className="inline-block text-[10px] bg-background/60 text-muted p-1 px-2 rounded max-w-[200px] truncate overflow-x-auto text-left font-mono">
                            {JSON.stringify(log.metadata)}
                          </pre>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    Không tìm thấy hoạt động nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
