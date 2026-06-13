import { requireAdmin } from "@/lib/auth/guards";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { 
  addSystemApiKeyAction, 
  reverifySystemApiKeyAction 
} from "@/app/actions/admin-keys";
import { 
  KeyRound, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle 
} from "lucide-react";
import { DeleteKeyButton } from "@/components/admin/delete-key-button";

export default async function AdminKeysPage() {
  await requireAdmin();

  // Fetch all system API keys from the DB
  const keys = await db
    .select()
    .from(schema.aiApiKeys)
    .orderBy(desc(schema.aiApiKeys.createdAt));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-light border border-success text-success px-2 py-0.5 text-xs font-bold leading-none">
            <CheckCircle2 size={12} /> Đang hoạt động
          </span>
        );
      case "rate_limited":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-light border border-warning text-warning px-2 py-0.5 text-xs font-bold leading-none animate-pulse">
            <AlertTriangle size={12} /> Rate Limited
          </span>
        );
      case "invalid":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-light border border-danger text-danger px-2 py-0.5 text-xs font-bold leading-none">
            <XCircle size={12} /> Hỏng (Invalid)
          </span>
        );
      default:
        return <span className="text-muted text-xs">{status}</span>;
    }
  };

  return (
    <>
      <div className="flex justify-between items-center border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-text m-0">Quản lý vòng xoay API Keys</h1>
          <p className="text-muted text-sm m-0">Thêm, xóa và kiểm tra sức khỏe của các API Key trong pool xoay vòng.</p>
        </div>
      </div>

      {/* Add New Key Form */}
      <section className="bg-surface border border-border rounded-lg p-5 sm:p-6 shadow-sm grid gap-4">
        <h2 className="text-lg font-bold text-text flex items-center gap-2 m-0">
          <Plus size={18} className="text-accent" /> Thêm API Key mới vào hệ thống
        </h2>
        
        <form action={addSystemApiKeyAction} className="grid grid-cols-1 sm:grid-cols-[1.5fr_2fr_1fr_auto] gap-3 items-end">
          <div className="grid gap-1">
            <label htmlFor="name" className="text-xs font-bold text-muted uppercase">Tên gợi nhớ</label>
            <input
              type="text"
              id="name"
              name="name"
              required
              placeholder="Ví dụ: Gemini Studio Key 1"
              className="min-h-10 px-3 rounded-md border border-border bg-background text-text text-sm transition-all focus:border-accent focus:outline-none"
            />
          </div>

          <div className="grid gap-1">
            <label htmlFor="apiKey" className="text-xs font-bold text-muted uppercase">Google AI Studio API Key</label>
            <input
              type="password"
              id="apiKey"
              name="apiKey"
              required
              placeholder="AIzaSy..."
              className="min-h-10 px-3 rounded-md border border-border bg-background text-text text-sm transition-all focus:border-accent focus:outline-none"
            />
          </div>

          <div className="grid gap-1">
            <label htmlFor="provider" className="text-xs font-bold text-muted uppercase">Nhà cung cấp</label>
            <select
              id="provider"
              name="provider"
              className="min-h-10 px-3 rounded-md border border-border bg-background text-text text-sm transition-all focus:border-accent focus:outline-none"
            >
              <option value="gemini">Google Gemini</option>
            </select>
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 min-h-10 rounded-md border border-transparent px-5 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover cursor-pointer"
          >
            Thêm Key
          </button>
        </form>
      </section>

      {/* Keys List Table */}
      <section className="bg-surface border border-border rounded-lg p-5 sm:p-6 shadow-sm">
        <h2 className="text-lg font-bold text-text flex items-center gap-2 mb-4 mt-0">
          <KeyRound size={18} className="text-muted" /> Danh sách API Keys hiện tại
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
                    <td className="py-3 pr-4 font-semibold text-text">{key.name}</td>
                    <td className="py-3 px-4">{getStatusBadge(key.status)}</td>
                    <td className="py-3 px-4 text-xs text-danger max-w-[240px] truncate" title={key.errorMessage ?? ""}>
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
                          <form action={reverifySystemApiKeyAction.bind(null, key.id)}>
                            <button
                              type="submit"
                              title="Kích hoạt lại key"
                              className="p-1.5 rounded-md border border-border bg-surface text-accent hover:bg-accent-light transition-all cursor-pointer"
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
