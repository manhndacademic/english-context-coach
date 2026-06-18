import { requireAdmin } from "@/lib/auth/guards";
import { db, schema } from "@/db";
import { desc, eq, or, ilike, and, sql } from "drizzle-orm";
import {
  approveUserAction,
  rejectUserAction,
  revokeUserAction,
} from "@/app/actions/admin-users";
import {
  Users as UsersIcon,
  UserCheck,
  UserX,
  Search,
  Check,
  X,
  Undo2,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  await requireAdmin();

  const handleUserAction = async (
    actionFn: (id: string) => Promise<any>,
    id: string
  ) => {
    "use server";
    await actionFn(id);
  };

  const params = await searchParams;
  const search = params.search || "";
  const status = params.status || "all";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 10;

  // 1. Fetch counts breakdown using a single optimized SQL query
  const [countsResult] = await db
    .select({
      total: sql<number>`count(*)`,
      pending: sql<number>`count(*) filter (where ${schema.users.status} = 'pending')`,
      approved: sql<number>`count(*) filter (where ${schema.users.status} = 'approved')`,
      rejected: sql<number>`count(*) filter (where ${schema.users.status} = 'rejected')`,
    })
    .from(schema.users);

  const stats = {
    total: Number(countsResult?.total || 0),
    pending: Number(countsResult?.pending || 0),
    approved: Number(countsResult?.approved || 0),
    rejected: Number(countsResult?.rejected || 0),
  };

  // 2. Build where clause for current filter / search
  const conditions = [];

  if (status !== "all") {
    conditions.push(
      eq(schema.users.status, status as "pending" | "approved" | "rejected")
    );
  }

  if (search.trim()) {
    conditions.push(
      or(
        ilike(schema.users.name, `%${search}%`),
        ilike(schema.users.email, `%${search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 3. Count total matching users for pagination
  const [totalMatchResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.users)
    .where(whereClause);

  const totalMatched = Number(totalMatchResult?.count || 0);
  const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));
  const currentPage = Math.min(page, totalPages);

  // 4. Fetch the paginated user list
  const usersList = await db
    .select()
    .from(schema.users)
    .where(whereClause)
    .orderBy(desc(schema.users.createdAt))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  // Helper to get status badge UI
  const getStatusBadge = (userStatus: string, role: string) => {
    if (role === "admin") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 border border-accent/30 text-accent px-2.5 py-0.5 text-xs font-bold">
          Admin (Duyệt sẵn)
        </span>
      );
    }

    switch (userStatus) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-success text-white dark:text-background border border-transparent px-2.5 py-0.5 text-xs font-bold">
            Đã duyệt
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger text-white dark:text-background border border-transparent px-2.5 py-0.5 text-xs font-bold">
            Bị từ chối
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning text-white dark:text-background border border-transparent px-2.5 py-0.5 text-xs font-bold animate-pulse">
            Chờ duyệt
          </span>
        );
    }
  };

  return (
    <>
      <div className="flex justify-between items-center border-b border-border pb-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-text m-0">
            Quản lý người dùng
          </h1>
          <p className="text-muted text-sm m-0">
            Phê duyệt, từ chối và quản lý danh sách học viên tham gia giai đoạn
            Early Access.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-background border border-border text-muted rounded-lg">
            <UsersIcon size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-muted uppercase">
              Tổng số
            </div>
            <div className="text-xl font-extrabold text-text mt-0.5">
              {stats.total}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-warning-light border border-warning text-warning-strong rounded-lg">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-muted uppercase">
              Chờ duyệt
            </div>
            <div className="text-xl font-extrabold text-text mt-0.5">
              {stats.pending}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-success-light border border-success text-success-strong rounded-lg">
            <UserCheck size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-muted uppercase">
              Đã duyệt
            </div>
            <div className="text-xl font-extrabold text-text mt-0.5">
              {stats.approved}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-danger-light border border-danger text-danger rounded-lg">
            <UserX size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-muted uppercase">
              Từ chối
            </div>
            <div className="text-xl font-extrabold text-text mt-0.5">
              {stats.rejected}
            </div>
          </div>
        </div>
      </section>

      {/* Filters and Search */}
      <section className="bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "all", label: "Tất cả", count: stats.total },
            { id: "pending", label: "Chờ duyệt", count: stats.pending },
            { id: "approved", label: "Đã duyệt", count: stats.approved },
            { id: "rejected", label: "Từ chối", count: stats.rejected },
          ].map((tab) => {
            const isActive = status === tab.id;
            return (
              <Link
                key={tab.id}
                href={`/admin/users?status=${tab.id}&search=${search}`}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${
                  isActive
                    ? "bg-accent border-accent text-white"
                    : "bg-background border-border text-muted hover:text-text hover:bg-surface-strong"
                }`}
              >
                {tab.label} ({tab.count})
              </Link>
            );
          })}
        </div>

        {/* Search Input Form */}
        <form
          method="GET"
          className="flex items-center gap-2 w-full md:max-w-xs relative"
        >
          <input type="hidden" name="status" value={status} />
          <div className="relative w-full">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Tìm theo tên hoặc email..."
              className="w-full min-h-9 pl-9 pr-3 rounded-md border border-border bg-background text-text text-sm transition-all focus:border-accent focus:outline-none"
            />
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>
          <button
            type="submit"
            className="bg-accent hover:bg-accent-hover text-white min-h-9 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
          >
            Tìm
          </button>
        </form>
      </section>

      {/* Main Table Card */}
      <section className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-muted font-bold text-xs uppercase tracking-wider">
                <th className="pb-2.5 pr-4">Học viên</th>
                <th className="pb-2.5 px-4">Quyền</th>
                <th className="pb-2.5 px-4">Trạng thái</th>
                <th className="pb-2.5 px-4">Ngày đăng ký</th>
                <th className="pb-2.5 pl-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usersList.length ? (
                usersList.map((u) => {
                  const isAdmin = u.role === "admin";
                  return (
                    <tr key={u.id} className="hover:bg-background/40">
                      <td className="py-3 pr-4 truncate max-w-[240px]">
                        <div className="font-semibold text-text">
                          {u.name || "Chưa cập nhật tên"}
                        </div>
                        <div className="text-xs text-muted truncate">
                          {u.email}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium capitalize text-xs">
                        {u.role}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(u.status, u.role)}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted">
                        {u.createdAt.toLocaleDateString("vi-VN", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        {!isAdmin && (
                          <div className="flex items-center justify-end gap-1.5">
                            {u.status !== "approved" && (
                              <form
                                action={handleUserAction.bind(
                                  null,
                                  approveUserAction,
                                  u.id
                                )}
                              >
                                <button
                                  type="submit"
                                  title="Phê duyệt quyền truy cập"
                                  className="bg-success-light border border-success hover:bg-success hover:text-white text-success-strong px-2.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <Check size={12} /> Duyệt
                                </button>
                              </form>
                            )}

                            {u.status !== "rejected" && (
                              <form
                                action={handleUserAction.bind(
                                  null,
                                  rejectUserAction,
                                  u.id
                                )}
                              >
                                <button
                                  type="submit"
                                  title="Từ chối truy cập"
                                  className="bg-danger-light border border-danger hover:bg-danger hover:text-white text-danger-strong px-2.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <X size={12} /> Từ chối
                                </button>
                              </form>
                            )}

                            {u.status !== "pending" && (
                              <form
                                action={handleUserAction.bind(
                                  null,
                                  revokeUserAction,
                                  u.id
                                )}
                              >
                                <button
                                  type="submit"
                                  title="Thu hồi quyền về chờ duyệt"
                                  className="bg-surface border border-border hover:bg-surface-strong text-muted hover:text-text px-2.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <Undo2 size={12} /> Thu hồi
                                </button>
                              </form>
                            )}
                          </div>
                        )}
                        {isAdmin && (
                          <span className="text-xs text-muted italic">
                            Mặc định được phê duyệt
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">
                    Không tìm thấy người dùng nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4 mt-4 text-xs">
            <span className="text-muted">
              Hiển thị trang <strong>{currentPage}</strong> trên{" "}
              <strong>{totalPages}</strong> (Tổng số{" "}
              <strong>{totalMatched}</strong> dòng)
            </span>
            <div className="flex gap-1">
              <Link
                href={`/admin/users?status=${status}&search=${search}&page=${currentPage - 1}`}
                className={`p-1.5 border border-border rounded-md hover:bg-surface-strong transition-all flex items-center ${
                  currentPage === 1 ? "pointer-events-none opacity-40" : ""
                }`}
                title="Trang trước"
              >
                <ChevronLeft size={16} />
              </Link>
              <Link
                href={`/admin/users?status=${status}&search=${search}&page=${currentPage + 1}`}
                className={`p-1.5 border border-border rounded-md hover:bg-surface-strong transition-all flex items-center ${
                  currentPage === totalPages
                    ? "pointer-events-none opacity-40"
                    : ""
                }`}
                title="Trang sau"
              >
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
