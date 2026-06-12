import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth-form";
import { ChevronLeft } from "lucide-react";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="grid place-items-center min-h-screen bg-background p-6">
      <section className="w-full max-w-[460px] grid gap-[18px] text-center">
        <Link 
          href="/" 
          className="border-0 bg-transparent text-muted text-sm font-semibold p-2 px-3 rounded-sm transition-all hover:text-text inline-flex items-center gap-1 self-start pl-0"
        >
          <ChevronLeft size={16} /> Quay về trang chủ
        </Link>
        <div className="mt-2.5">
          <p className="font-serif text-2xl font-extrabold tracking-tight text-accent text-center m-0">
            English Context Coach
          </p>
          <h1 className="text-2xl font-extrabold font-serif mt-3 mb-1.5 text-text">
            Đăng nhập tài khoản học
          </h1>
          <p className="text-muted text-sm leading-relaxed m-0">
            Luyện tập tiếng Anh từ email, Slack, docs thực tế trong công việc với phản hồi tiếng Việt.
          </p>
        </div>
        <LoginForm googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />
        <p className="text-center text-muted text-sm mt-2">
          Bạn mới đến lần đầu?{" "}
          <Link href="/register" className="font-semibold text-accent hover:text-accent-hover">
            Đăng ký tài khoản
          </Link>
        </p>
      </section>
    </main>
  );
}
