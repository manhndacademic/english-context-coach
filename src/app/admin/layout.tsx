import { requireAdmin } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import Link from "next/link";
import { LayoutDashboard, KeyRound, ArrowLeft } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
      <AppHeader email={user.email} isAdmin={true} />

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 items-start">
        <aside className="bg-surface border border-border rounded-lg p-4 shadow-sm flex flex-col gap-1">
          <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted mb-2">
            Trình quản trị LLM
          </div>
          <Link
            href="/admin"
            className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-md transition-all text-text hover:bg-surface-strong"
          >
            <LayoutDashboard size={16} className="text-muted" /> Tổng quan số liệu
          </Link>
          <Link
            href="/admin/keys"
            className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-md transition-all text-text hover:bg-surface-strong"
          >
            <KeyRound size={16} className="text-muted" /> Vòng xoay API Keys
          </Link>
          <hr className="border-border my-2" />
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-md transition-all text-muted hover:text-text hover:bg-surface-strong"
          >
            <ArrowLeft size={16} /> Quay lại học tập
          </Link>
        </aside>

        <section className="flex flex-col gap-6 w-full">
          {children}
        </section>
      </div>
    </main>
  );
}
