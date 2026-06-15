import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { logoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Clock, XCircle } from "lucide-react";
import { ReloadButton } from "@/components/reload-button";

export default async function PendingApprovalPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch fresh user data from DB to check current status
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);

  if (!user) {
    redirect("/login");
  }

  // If already approved or admin, redirect to dashboard
  if (user.role === "admin" || user.status === "approved") {
    redirect("/dashboard");
  }

  const isRejected = user.status === "rejected";

  return (
    <main className="grid place-items-center min-h-screen bg-background p-6">
      <section className="w-full max-w-[460px] grid gap-[18px] text-center">
        <div className="mt-2.5">
          <p className="font-serif text-2xl font-extrabold tracking-tight text-accent text-center m-0">
            English Context Coach
          </p>
        </div>

        <div className="p-7 rounded-lg shadow-lg grid gap-6 text-center bg-surface border border-border">
          <div className="flex justify-center">
            {isRejected ? (
              <div className="p-3 bg-danger-light border border-danger text-danger rounded-full">
                <XCircle size={36} />
              </div>
            ) : (
              <div className="p-3 bg-warning-light border border-warning text-warning rounded-full animate-pulse">
                <Clock size={36} />
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <h1 className="text-xl font-extrabold text-text m-0">
              {isRejected
                ? "Tài khoản bị từ chối truy cập"
                : "Tài khoản đang chờ phê duyệt"}
            </h1>
            <p className="text-muted text-sm leading-relaxed m-0">
              {isRejected
                ? "Rất tiếc, yêu cầu tham gia ứng dụng của bạn đã bị từ chối. Vui lòng liên hệ với quản trị viên nếu bạn tin rằng đây là một sự nhầm lẫn."
                : "Ứng dụng hiện đang trong giai đoạn thử nghiệm giới hạn (Early Access). Vui lòng đợi quản trị viên duyệt tài khoản của bạn để bắt đầu luyện tập."}
            </p>
          </div>

          <div className="grid gap-3">
            {!isRejected && <ReloadButton />}

            <form action={logoutAction} className="w-full">
              <Button
                variant="secondary"
                className="w-full h-11 font-semibold"
                type="submit"
              >
                Đăng xuất tài khoản
              </Button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
