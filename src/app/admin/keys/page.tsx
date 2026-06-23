import { requireAdmin } from "@/lib/auth/guards";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { reverifySystemApiKeyAction } from "@/app/actions/admin-keys";
import {
  KeyRound,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { DeleteKeyButton } from "@/components/admin/delete-key-button";
import { AddSystemKeyForm } from "@/components/admin/add-system-key-form";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success text-white dark:text-background border border-transparent px-2 py-0.5 text-xs font-bold leading-none">
          <CheckCircle2 size={12} /> Đang hoạt động
        </span>
      );
    case "rate_limited":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning text-white dark:text-background border border-transparent px-2 py-0.5 text-xs font-bold leading-none animate-pulse">
          <AlertTriangle size={12} /> Rate Limited
        </span>
      );
    case "invalid":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger text-white dark:text-background border border-transparent px-2 py-0.5 text-xs font-bold leading-none">
          <XCircle size={12} /> Hỏng (Invalid)
        </span>
      );
    default:
      return <span className="text-muted text-xs">{status}</span>;
  }
};

export default async function AdminKeysPage() {
  await requireAdmin();

  // Fetch all system API keys from the DB
  const keys = await db
    .select()
    .from(schema.aiApiKeys)
    .orderBy(desc(schema.aiApiKeys.createdAt));

  return (
    <>
      <div className="flex justify-between items-center border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-text m-0">
            Quản lý vòng xoay API Keys
          </h1>
          <p className="text-muted text-sm m-0">
            Thêm, xóa và kiểm tra sức khỏe của các API Key trong pool xoay vòng.
          </p>
        </div>
      </div>

      <AddSystemKeyForm />

      {/* Keys List Table */}
      <section className="bg-surface border border-border rounded-lg p-5 sm:p-6 shadow-sm">
        <h2 className="text-lg font-bold text-text flex items-center gap-2 mb-4 mt-0">
          <KeyRound size={18} className="text-muted" /> Danh sách API Keys hiện
          tại
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-muted font-bold text-xs uppercase tracking-wider">
                <th className="pb-2.5 pr-4">Tên Key</th>
                <th className="pb-2.5 px-4">Trạng thái</th>
                <th className="pb-2.5 px-4">Lỗi gần nhất</th>
                <th className="pb-2.5 px-4">Tạo lúc</th>
                <th className="pb-2.5 pl-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.length ? (
                keys.map((key) => (
                  <tr key={key.id} className="hover:bg-background/40">
                    <td className="py-3 pr-4 font-semibold text-text">
                      {key.name}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(key.status)}</td>
                    <td
                      className="py-3 px-4 text-xs text-danger max-w-60 truncate"
                      title={key.errorMessage ?? ""}
                    >
                      {key.errorMessage || "—"}
                    </td>
                    <td className="py-3 px-4 text-muted text-xs">
                      {key.createdAt.toLocaleDateString("vi-VN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {key.status !== "active" && (
                          <form action={reverifySystemApiKeyAction}>
                            <input type="hidden" name="keyId" value={key.id} />
                            <button
                              type="submit"
                              title="Xác thực lại key"
                              className="p-1.5 rounded-md border border-border bg-surface text-accent-strong hover:bg-accent-light transition-all cursor-pointer"
                            >
                              <RefreshCw size={14} />
                            </button>
                          </form>
                        )}
                        <DeleteKeyButton keyId={key.id} keyName={key.name} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    Chưa có API key nào được đăng ký trong hệ thống.
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
